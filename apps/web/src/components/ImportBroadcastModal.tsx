'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconClose } from './icons';

type ParsedSheet = { headers: string[]; rows: string[][] };

// A template variable is filled from a spreadsheet column or a literal value.
type VarSource = { mode: 'column'; col: number } | { mode: 'literal'; value: string };

function guessColumn(headers: string[], keywords: string[]): number {
  const i = headers.findIndex((h) =>
    keywords.some((k) => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k)),
  );
  return i;
}

export function ImportBroadcastModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (broadcastId: string) => void;
}) {
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<TemplateDto[]>('/templates'),
  });
  const approved = (templatesQuery.data ?? []).filter((t) => t.status === 'approved');

  const [name, setName] = useState('');
  const [listTag, setListTag] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [phoneCol, setPhoneCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [emailCol, setEmailCol] = useState<number>(-1);
  const [varSources, setVarSources] = useState<VarSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedTemplate = useMemo(
    () => approved.find((t) => t.id === templateId),
    [approved, templateId],
  );

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const t = approved.find((x) => x.id === id);
    const n = t?.bodyVarCount ?? 0;
    // Default {{1}} to the detected name column, the rest to empty literals.
    setVarSources(
      Array.from({ length: n }, (_, i) =>
        i === 0 && nameCol >= 0
          ? ({ mode: 'column', col: nameCol } as VarSource)
          : ({ mode: 'literal', value: '' } as VarSource),
      ),
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        defval: '',
        raw: false,
      });
      const nonEmpty = matrix.filter((r) => r.some((c) => String(c).trim() !== ''));
      if (nonEmpty.length < 2) {
        setError('The sheet needs a header row and at least one data row.');
        setSheet(null);
        return;
      }
      const headers = nonEmpty[0].map((h) => String(h ?? '').trim());
      const rows = nonEmpty.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? '').trim()));
      setSheet({ headers, rows });
      const pc = guessColumn(headers, ['phone', 'number', 'mobile', 'whatsapp', 'contact', 'wa']);
      const ncol = guessColumn(headers, ['name', 'fullname', 'firstname']);
      const ecol = guessColumn(headers, ['email', 'mail']);
      setPhoneCol(pc);
      setNameCol(ncol);
      setEmailCol(ecol);
      // re-seed the first variable to the freshly detected name column
      setVarSources((prev) =>
        prev.map((v, i) => (i === 0 && ncol >= 0 ? { mode: 'column', col: ncol } : v)),
      );
    } catch (err: any) {
      setError('Could not read that file. Use a .xlsx or .csv export.');
      setSheet(null);
    }
  }

  // Build the recipients we'll POST, resolving each variable per row.
  const recipients = useMemo(() => {
    if (!sheet || phoneCol < 0) return [];
    return sheet.rows.map((row) => ({
      phone: row[phoneCol] ?? '',
      name: nameCol >= 0 ? row[nameCol] : undefined,
      email: emailCol >= 0 ? row[emailCol] : undefined,
      params: varSources.map((v) =>
        v.mode === 'column' ? (row[v.col] ?? '') : v.value,
      ),
    }));
  }, [sheet, phoneCol, nameCol, emailCol, varSources]);

  const validCount = useMemo(
    () => recipients.filter((r) => String(r.phone).replace(/[^\d]/g, '').length >= 8).length,
    [recipients],
  );

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Give the campaign a name.');
    if (!templateId) return setError('Choose an approved template.');
    if (!sheet || phoneCol < 0) return setError('Upload a file and pick the phone-number column.');
    if (validCount === 0) return setError('No valid phone numbers found in the selected column.');

    setBusy(true);
    try {
      const res = await api.post<{ id: string; imported: number; skipped: number }>(
        '/broadcasts/import',
        { name: name.trim(), templateId, listTag: listTag.trim() || undefined, recipients },
      );
      onDone(res.id);
    } catch (err: any) {
      setError(err?.message ?? 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  const colOptions = (sheet?.headers ?? []).map((h, i) => (
    <option key={i} value={i}>
      {h || `Column ${i + 1}`}
    </option>
  ));

  return (
    <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-card flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-none items-start justify-between border-b border-white/40 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Import & bulk broadcast</div>
            <div className="text-xs text-gray-400">
              Upload an Excel/CSV of numbers, names & emails, then send an approved template to all of them.
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <IconClose />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}

          {/* Campaign basics */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="July webinar invite"
                className="w-full glass-input rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                List tag <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={listTag}
                onChange={(e) => setListTag(e.target.value)}
                placeholder="july-webinar"
                className="w-full glass-input rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Template (approved only)</label>
            <select
              value={templateId}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2"
            >
              <option value="">Select a template…</option>
              {approved.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language}) · {t.bodyVarCount} var{t.bodyVarCount === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>

          {/* File upload */}
          <div>
            <label className="mb-1 block text-sm font-medium">Contact file (.xlsx / .csv)</label>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-white/40 py-5 text-sm font-medium text-brand-dark transition hover:bg-white/60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {fileName ? `Selected: ${fileName}` : 'Click to choose an Excel or CSV file'}
            </button>
          </div>

          {/* Column mapping */}
          {sheet && (
            <div className="space-y-4 rounded-2xl border border-white/50 bg-white/30 p-4">
              <div className="text-sm font-semibold text-gray-700">
                Map your columns
                <span className="ml-2 font-normal text-gray-400">
                  {sheet.rows.length} rows detected
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Phone *</label>
                  <select
                    value={phoneCol}
                    onChange={(e) => setPhoneCol(Number(e.target.value))}
                    className="w-full glass-input rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value={-1}>— select —</option>
                    {colOptions}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
                  <select
                    value={nameCol}
                    onChange={(e) => setNameCol(Number(e.target.value))}
                    className="w-full glass-input rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value={-1}>— none —</option>
                    {colOptions}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
                  <select
                    value={emailCol}
                    onChange={(e) => setEmailCol(Number(e.target.value))}
                    className="w-full glass-input rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value={-1}>— none —</option>
                    {colOptions}
                  </select>
                </div>
              </div>

              {/* Template variable binding */}
              {selectedTemplate && selectedTemplate.bodyVarCount > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500">
                    Personalize template variables
                  </div>
                  {selectedTemplate.bodyText && (
                    <p className="rounded bg-white/50 p-2 text-xs text-gray-500">
                      {selectedTemplate.bodyText}
                    </p>
                  )}
                  {varSources.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 flex-none rounded bg-yellow-200/70 px-1 text-center text-xs font-medium text-yellow-900">
                        {`{{${i + 1}}}`}
                      </span>
                      <select
                        value={v.mode === 'column' ? `col:${v.col}` : 'literal'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVarSources((prev) =>
                            prev.map((x, idx) => {
                              if (idx !== i) return x;
                              if (val === 'literal') return { mode: 'literal', value: '' };
                              return { mode: 'column', col: Number(val.split(':')[1]) };
                            }),
                          );
                        }}
                        className="glass-input rounded-lg px-2 py-1.5 text-sm"
                      >
                        <option value="literal">Fixed text…</option>
                        {sheet.headers.map((h, ci) => (
                          <option key={ci} value={`col:${ci}`}>
                            Column: {h || `Column ${ci + 1}`}
                          </option>
                        ))}
                      </select>
                      {v.mode === 'literal' && (
                        <input
                          value={v.value}
                          onChange={(e) =>
                            setVarSources((prev) =>
                              prev.map((x, idx) =>
                                idx === i ? { mode: 'literal', value: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder={`Value for {{${i + 1}}}`}
                          className="flex-1 glass-input rounded-lg px-2 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              <div className="rounded-xl bg-white/40 p-3 text-xs text-gray-600">
                <span className="font-semibold text-green-700">{validCount}</span> valid recipients ready
                {recipients.length - validCount > 0 && (
                  <span className="text-amber-600">
                    {' '}· {recipients.length - validCount} rows will be skipped (invalid number)
                  </span>
                )}
                {recipients[0] && (
                  <div className="mt-1 truncate text-gray-400">
                    e.g. +{String(recipients[0].phone).replace(/[^\d]/g, '')}
                    {recipients[0].name ? ` · ${recipients[0].name}` : ''}
                    {selectedTemplate && selectedTemplate.bodyVarCount > 0
                      ? ` · vars: ${recipients[0].params.join(', ')}`
                      : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-none items-center justify-between gap-3 border-t border-white/40 px-6 py-4">
          <p className="text-xs text-gray-400">
            Numbers must include the country code. Sends respect WhatsApp rate limits.
          </p>
          <button
            onClick={submit}
            disabled={busy || validCount === 0 || !templateId || !name.trim()}
            className="rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 py-2.5 font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
          >
            {busy ? 'Sending…' : `Send to ${validCount || 0}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

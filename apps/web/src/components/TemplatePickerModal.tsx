'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconClose } from './icons';

const CATEGORY_BADGE: Record<string, string> = {
  utility: 'bg-blue-100 text-blue-700',
  marketing: 'bg-brand/15 text-brand-dark',
  authentication: 'bg-emerald-100 text-emerald-700',
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_BADGE[category] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {category}
    </span>
  );
}

function highlightVars(text: string) {
  return text.split(/(\{\{\s*\d+\s*\}\})/g).map((part, i) =>
    /\{\{\s*\d+\s*\}\}/.test(part) ? (
      <span key={i} className="rounded bg-yellow-200/70 px-1 font-medium text-yellow-900">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'utility', label: 'Utility' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'authentication', label: 'Auth' },
];

export function TemplatePickerModal({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (templateId: string, bodyParams: string[]) => Promise<void>;
}) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<TemplateDto | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<TemplateDto[]>('/templates'),
  });

  const approved = (templatesQuery.data ?? []).filter((t) => t.status === 'approved');
  const shown = useMemo(
    () => (filter === 'all' ? approved : approved.filter((t) => t.category === filter)),
    [approved, filter],
  );

  function pick(t: TemplateDto) {
    setSelected(t);
    setParams(new Array(t.bodyVarCount).fill(''));
    setError(null);
  }

  // Live preview with the agent's filled-in values.
  const rendered = useMemo(() => {
    if (!selected?.bodyText) return null;
    return selected.bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => params[Number(n) - 1] || `{{${n}}}`);
  }, [selected, params]);

  async function send() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(selected.id, params);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send template');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-none items-center justify-between border-b border-white/40 px-5 py-4">
          <div>
            <div className="font-semibold text-gray-900">Send a template</div>
            <div className="text-xs text-gray-400">
              Approved templates — works even after the 24-hour window closes.
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <IconClose />
          </button>
        </header>

        {!selected ? (
          <>
            {/* Category filter */}
            <div className="flex flex-none gap-2 border-b border-white/40 px-5 py-3">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === f.value
                      ? 'bg-brand text-white shadow-sm shadow-brand/30'
                      : 'bg-white/50 text-gray-600 hover:bg-white/80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {shown.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No approved templates in this category.
                </p>
              )}
              {shown.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t)}
                  className="flex w-full flex-col gap-1 rounded-2xl border border-white/50 bg-white/40 p-3 text-left transition hover:bg-white/70"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <CategoryBadge category={t.category} />
                    <span className="text-xs uppercase text-gray-400">{t.language}</span>
                    {t.bodyVarCount > 0 && (
                      <span className="ml-auto text-[10px] text-gray-400">
                        {t.bodyVarCount} var{t.bodyVarCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {t.bodyText && (
                    <p className="line-clamp-2 text-xs text-gray-500">{highlightVars(t.bodyText)}</p>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{selected.name}</span>
                <CategoryBadge category={selected.category} />
                <span className="text-xs uppercase text-gray-400">{selected.language}</span>
              </div>

              {/* Live WhatsApp-style preview */}
              <div className="rounded-2xl bg-white/30 p-4">
                <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 shadow-sm">
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-800">
                    {rendered ?? <span className="italic text-gray-400">No body text</span>}
                  </div>
                </div>
              </div>

              {selected.bodyVarCount > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Fill in the variables</label>
                  {params.map((v, i) => (
                    <input
                      key={i}
                      value={v}
                      onChange={(e) =>
                        setParams((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))
                      }
                      placeholder={`{{${i + 1}}}`}
                      className="w-full glass-input rounded-xl px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              )}
            </div>

            <footer className="flex flex-none items-center justify-between gap-3 border-t border-white/40 px-5 py-4">
              <button
                onClick={() => setSelected(null)}
                className="rounded-full px-4 py-2 text-sm font-medium text-gray-500 hover:bg-white/60"
              >
                ← Back
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 py-2.5 font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send template'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

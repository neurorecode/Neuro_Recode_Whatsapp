'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconClose } from './icons';
import { GlassSelect } from './GlassSelect';

// Colored dot per WhatsApp template category, shown beside each option.
const CATEGORY_DOT: Record<string, string> = {
  utility: 'bg-blue-500',
  marketing: 'bg-purple-500',
  authentication: 'bg-emerald-500',
};

export function NewChatModal({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (conversationId: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<TemplateDto[]>('/templates'),
  });
  const approved = (templatesQuery.data ?? []).filter((t) => t.status === 'approved');
  const selected = useMemo(() => approved.find((t) => t.id === templateId), [approved, templateId]);

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const t = approved.find((x) => x.id === id);
    setBodyParams(t ? new Array(t.bodyVarCount).fill('') : []);
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ conversationId: string }>('/conversations/start', {
        phone,
        templateId,
        bodyParams,
      });
      onStarted(res.conversationId);
    } catch (err: any) {
      setError(err?.message ?? 'Could not start the conversation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-none items-center justify-between border-b border-white/40 px-5 py-4">
          <div>
            <div className="font-semibold text-gray-900">New conversation</div>
            <div className="text-xs text-gray-400">
              WhatsApp requires an approved template to message a new number.
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <IconClose />
          </button>
        </header>

        <form onSubmit={start} className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-sm font-medium">Phone number</label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Country code + number, e.g. 919876543210"
              className="w-full glass-input rounded-xl px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-400">Include the country code, no + or spaces needed.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Template</label>
            <GlassSelect
              value={templateId}
              onChange={onTemplateChange}
              options={approved.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.language})`,
                hint: t.category.toUpperCase(),
                dotClass: CATEGORY_DOT[t.category] ?? 'bg-gray-400',
              }))}
              placeholder="Select an approved template…"
              className="w-full"
            />
            {approved.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                No approved templates — sync them on the Templates page.
              </p>
            )}
          </div>

          {selected && selected.bodyVarCount > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Template variables</label>
              {selected.bodyText && (
                <p className="rounded bg-gray-50 p-2 text-xs text-gray-500">{selected.bodyText}</p>
              )}
              {bodyParams.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) =>
                    setBodyParams((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                  placeholder={`{{${i + 1}}}`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !phone || !templateId}
            className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Start conversation'}
          </button>
        </form>
      </div>
    </div>
  );
}

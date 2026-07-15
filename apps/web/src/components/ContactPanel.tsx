'use client';

import { useState } from 'react';
import type { ContactDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconClose } from './icons';

const OPT_OPTIONS = [
  { value: 'opted_in', label: 'Opted in', style: 'bg-green-500 text-white' },
  { value: 'unknown', label: 'Unknown', style: 'bg-gray-400 text-white' },
  { value: 'opted_out', label: 'Opted out', style: 'bg-red-500 text-white' },
];

export function ContactPanel({
  contact,
  onUpdated,
  onClose,
}: {
  contact: ContactDto;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const name = contact.displayName || contact.profileName || contact.waId;

  async function patch(data: { tags?: string[]; optInStatus?: string }) {
    setBusy(true);
    try {
      await api.patch(`/contacts/${contact.id}`, data);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  function addTag() {
    const t = draft.trim();
    if (!t || contact.tags.includes(t)) return setDraft('');
    patch({ tags: [...contact.tags, t] });
    setDraft('');
  }

  return (
    <aside className="flex w-80 flex-none flex-col border-l bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Contact details</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <IconClose />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-lg font-semibold text-white">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{name}</div>
            <div className="text-xs text-gray-400">+{contact.waId}</div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Opt-in status
          </div>
          <div className="flex gap-1.5">
            {OPT_OPTIONS.map((o) => (
              <button
                key={o.value}
                disabled={busy}
                onClick={() => patch({ optInStatus: o.value })}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  contact.optInStatus === o.value
                    ? o.style
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Tags
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {contact.tags.length === 0 && (
              <span className="text-xs text-gray-400">No tags yet.</span>
            )}
            {contact.tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand-dark"
              >
                {t}
                <button
                  onClick={() => patch({ tags: contact.tags.filter((x) => x !== t) })}
                  className="text-brand/60 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>
    </aside>
  );
}

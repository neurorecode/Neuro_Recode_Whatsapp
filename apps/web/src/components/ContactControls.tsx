'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

/**
 * Inline editor for a contact's tags + opt-in status, shown in the conversation
 * header. Tags feed broadcast audiences; opt-in gates who can be broadcast to.
 */
export function ContactControls({
  contactId,
  tags,
  optInStatus,
  onUpdated,
}: {
  contactId: string;
  tags: string[];
  optInStatus: string;
  onUpdated: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function patch(data: { tags?: string[]; optInStatus?: string }) {
    setBusy(true);
    try {
      await api.patch(`/contacts/${contactId}`, data);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  function addTag() {
    const t = draft.trim();
    if (!t || tags.includes(t)) {
      setDraft('');
      return;
    }
    patch({ tags: [...tags, t] });
    setDraft('');
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
        >
          {t}
          <button
            onClick={() => patch({ tags: tags.filter((x) => x !== t) })}
            className="text-gray-400 hover:text-red-500"
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
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
        placeholder="+ tag"
        className="w-20 rounded border border-gray-300 px-2 py-0.5 text-xs focus:border-brand focus:outline-none"
      />
      <select
        value={optInStatus}
        disabled={busy}
        onChange={(e) => patch({ optInStatus: e.target.value })}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-brand focus:outline-none"
        title="Broadcast opt-in status"
      >
        <option value="unknown">opt-in: unknown</option>
        <option value="opted_in">opted in</option>
        <option value="opted_out">opted out</option>
      </select>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InternalNoteDto } from '@nrw/shared';
import { api } from '@/lib/api';

export function NotesPanel({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const notesQuery = useQuery({
    queryKey: ['notes', conversationId],
    queryFn: () => api.get<InternalNoteDto[]>(`/conversations/${conversationId}/notes`),
  });

  async function add() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      await api.post(`/conversations/${conversationId}/notes`, { body });
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['notes', conversationId] });
    } finally {
      setSaving(false);
    }
  }

  const notes = notesQuery.data ?? [];

  return (
    <aside className="flex w-72 flex-none flex-col border-l bg-amber-50">
      <header className="border-b border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800">
        Internal notes
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {notes.length === 0 && (
          <p className="text-xs text-amber-700/70">No notes yet. Only agents see these.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="rounded bg-white p-2 text-sm shadow-sm">
            <div className="whitespace-pre-wrap break-words">{n.body}</div>
            <div className="mt-1 text-[10px] text-gray-400">
              {n.agentName} · {new Date(n.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-amber-200 p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a note (Ctrl/⌘+Enter)"
          rows={2}
          className="w-full rounded border border-amber-200 px-2 py-1 text-sm focus:border-amber-400 focus:outline-none"
        />
        <button
          onClick={add}
          disabled={saving || !draft.trim()}
          className="mt-1 w-full rounded bg-amber-500 py-1 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          Add note
        </button>
      </div>
    </aside>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InternalNoteDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconClose, IconTrash } from './icons';

export function NotesPanel({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const notesQuery = useQuery({
    queryKey: ['notes', conversationId],
    queryFn: () => api.get<InternalNoteDto[]>(`/conversations/${conversationId}/notes`),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['notes', conversationId] });
  }

  async function add() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      await api.post(`/conversations/${conversationId}/notes`, { body });
      setDraft('');
      invalidate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(noteId: string) {
    await api.del(`/conversations/${conversationId}/notes/${noteId}`);
    invalidate();
  }

  const notes = notesQuery.data ?? [];

  return (
    <aside className="flex w-80 flex-none flex-col border-l border-white/40 bg-amber-50/40 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-amber-200 px-4 py-3">
        <span className="text-sm font-semibold text-amber-800">Internal notes</span>
        <button onClick={onClose} className="text-amber-400 hover:text-amber-700">
          <IconClose />
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {notes.length === 0 && (
          <p className="px-1 text-xs text-amber-700/70">
            No notes yet. Only your team sees these — customers never do.
          </p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="group rounded-lg bg-white p-3 shadow-sm ring-1 ring-amber-100">
            <div className="whitespace-pre-wrap break-words text-sm text-gray-800">{n.body}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {n.agentName} · {new Date(n.createdAt).toLocaleString()}
              </span>
              <button
                onClick={() => remove(n.id)}
                title="Delete note"
                className="text-gray-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              >
                <IconTrash width={14} height={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-amber-200 p-3">
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
          className="w-full resize-none rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <button
          onClick={add}
          disabled={saving || !draft.trim()}
          className="mt-1.5 w-full rounded-lg bg-amber-500 py-1.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </aside>
  );
}

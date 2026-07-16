'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgentDto, ConversationListItem } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconInfo, IconNote } from './icons';
import { GlassSelect, type GlassOption } from './GlassSelect';

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const STATUS_TEXT: Record<string, string> = {
  open: 'text-green-700',
  pending: 'text-amber-700',
  closed: 'text-gray-600',
};

export function ConversationHeader({
  conversation,
  onUpdated,
  infoOpen,
  notesOpen,
  onToggleInfo,
  onToggleNotes,
}: {
  conversation: ConversationListItem;
  onUpdated: () => void;
  infoOpen: boolean;
  notesOpen: boolean;
  onToggleInfo: () => void;
  onToggleNotes: () => void;
}) {
  const c = conversation;
  const name = c.contact.displayName || c.contact.profileName || c.contact.waId;

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<AgentDto[]>('/agents'),
    staleTime: 60000,
  });

  async function patch(data: Record<string, unknown>) {
    await api.patch(`/conversations/${c.id}`, data);
    onUpdated();
  }

  const statusOptions: GlassOption[] = [
    { value: 'open', label: 'Open', dotClass: 'bg-green-500' },
    { value: 'pending', label: 'Pending', dotClass: 'bg-amber-500' },
    { value: 'closed', label: 'Closed', dotClass: 'bg-gray-400' },
  ];
  const assigneeOptions: GlassOption[] = [
    { value: '', label: 'Unassigned' },
    ...(agentsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/40 bg-gradient-to-b from-white/40 to-white/15 px-5 py-3">
      {/* Contact identity */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-semibold text-white shadow-sm">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-gray-900">{name}</div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="truncate">+{c.contact.waId}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                c.windowOpen ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${c.windowOpen ? 'bg-green-500' : 'bg-amber-500'}`}
              />
              {c.windowOpen ? 'window open' : 'window closed'}
            </span>
          </div>
        </div>
      </div>

      {/* Ticket controls */}
      <div className="flex flex-none items-center gap-2">
        <GlassSelect
          value={c.status}
          onChange={(v) => patch({ status: v })}
          options={statusOptions}
          className={`w-[120px] ${STATUS_TEXT[c.status] ?? ''}`}
        />
        <GlassSelect
          value={c.assigneeAgentId ?? ''}
          onChange={(v) => patch({ assigneeAgentId: v || null })}
          options={assigneeOptions}
          className="w-[160px]"
          leading={
            <span className="flex-none text-gray-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </span>
          }
        />

        <div className="mx-1 h-6 w-px bg-white/50" />

        <button
          onClick={onToggleInfo}
          title="Contact details"
          className={`flex h-9 w-9 items-center justify-center rounded-full soft-btn ${
            infoOpen ? 'text-brand ring-2 ring-brand/40' : 'text-gray-500'
          }`}
        >
          <IconInfo />
        </button>
        <button
          onClick={onToggleNotes}
          title="Internal notes"
          className={`flex h-9 w-9 items-center justify-center rounded-full soft-btn ${
            notesOpen ? 'text-amber-600 ring-2 ring-amber-400/50' : 'text-gray-500'
          }`}
        >
          <IconNote />
        </button>
      </div>
    </header>
  );
}

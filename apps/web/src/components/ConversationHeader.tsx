'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgentDto, ConversationListItem } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconInfo, IconNote } from './icons';

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const STATUS_DOT: Record<string, string> = {
  open: 'bg-green-500',
  pending: 'bg-amber-500',
  closed: 'bg-gray-400',
};
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

  const selectBase =
    'appearance-none soft-control rounded-full py-2 pl-8 pr-8 text-xs font-semibold text-gray-700 cursor-pointer';
  const chevron =
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")] bg-[length:14px] bg-[right_0.5rem_center] bg-no-repeat";

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
        <div className="relative">
          <span
            className={`pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
              STATUS_DOT[c.status] ?? 'bg-gray-400'
            }`}
          />
          <select
            value={c.status}
            onChange={(e) => patch({ status: e.target.value })}
            className={`${selectBase} ${chevron} ${STATUS_TEXT[c.status] ?? ''}`}
            title="Ticket status"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </span>
          <select
            value={c.assigneeAgentId ?? ''}
            onChange={(e) => patch({ assigneeAgentId: e.target.value || null })}
            className={`${selectBase} ${chevron} max-w-[160px]`}
            title="Assign to agent"
          >
            <option value="">Unassigned</option>
            {(agentsQuery.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

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

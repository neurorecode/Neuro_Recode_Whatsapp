'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgentDto, ConversationListItem } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconInfo, IconNote } from './icons';

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const STATUS_STYLES: Record<string, string> = {
  open: 'text-green-700 ring-green-200 bg-green-50',
  pending: 'text-amber-700 ring-amber-200 bg-amber-50',
  closed: 'text-gray-600 ring-gray-200 bg-gray-100',
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
    'appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-gray-700 shadow-sm transition hover:border-gray-300 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';
  const chevron =
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")] bg-[length:14px] bg-[right_0.4rem_center] bg-no-repeat";

  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/40 bg-white/25 px-5 py-3">
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
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                c.windowOpen ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {c.windowOpen ? 'window open' : 'window closed'}
            </span>
          </div>
        </div>
      </div>

      {/* Ticket controls */}
      <div className="flex flex-none items-center gap-2">
        <div className="relative">
          <select
            value={c.status}
            onChange={(e) => patch({ status: e.target.value })}
            className={`${selectBase} ${chevron} ring-1 ${STATUS_STYLES[c.status] ?? ''}`}
            title="Ticket status"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <select
          value={c.assigneeAgentId ?? ''}
          onChange={(e) => patch({ assigneeAgentId: e.target.value || null })}
          className={`${selectBase} ${chevron} max-w-[150px]`}
          title="Assign to agent"
        >
          <option value="">Unassigned</option>
          {(agentsQuery.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <button
          onClick={onToggleInfo}
          title="Contact details"
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
            infoOpen
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <IconInfo />
        </button>
        <button
          onClick={onToggleNotes}
          title="Internal notes"
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
            notesOpen
              ? 'border-amber-400 bg-amber-50 text-amber-600'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <IconNote />
        </button>
      </div>
    </header>
  );
}

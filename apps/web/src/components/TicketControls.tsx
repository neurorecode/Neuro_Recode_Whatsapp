'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgentDto } from '@nrw/shared';
import { api } from '@/lib/api';

export function TicketControls({
  conversationId,
  status,
  assigneeAgentId,
  onUpdated,
}: {
  conversationId: string;
  status: string;
  assigneeAgentId: string | null;
  onUpdated: () => void;
}) {
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<AgentDto[]>('/agents'),
    staleTime: 60000,
  });

  async function patch(data: { status?: string; assigneeAgentId?: string | null }) {
    await api.patch(`/conversations/${conversationId}`, data);
    onUpdated();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => patch({ status: e.target.value })}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-brand focus:outline-none"
        title="Ticket status"
      >
        <option value="open">Open</option>
        <option value="pending">Pending</option>
        <option value="closed">Closed</option>
      </select>
      <select
        value={assigneeAgentId ?? ''}
        onChange={(e) => patch({ assigneeAgentId: e.target.value || null })}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-brand focus:outline-none"
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
  );
}

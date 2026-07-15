'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { BroadcastDetail } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/PageHeader';

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'read' || status === 'delivered' || status === 'sent'
      ? 'bg-green-100 text-green-700'
      : status === 'failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-600';
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}

export default function BroadcastDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { ready } = useRequireAuth();

  const query = useQuery({
    queryKey: ['broadcast', id],
    queryFn: () => api.get<BroadcastDetail>(`/broadcasts/${id}`),
    enabled: ready,
    refetchInterval: (q) =>
      q.state.data && (q.state.data.status === 'running' ? 3000 : false),
  });

  const b = query.data;

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader
          title={b?.name ?? 'Broadcast'}
          subtitle={
            b ? `Template ${b.template.name} (${b.template.language}) · ${b.status}` : undefined
          }
        />
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <Link href="/broadcasts" className="text-sm text-brand hover:underline">
            ← Back to broadcasts
          </Link>

          {!b ? (
            <div className="mt-6 text-gray-400">Loading…</div>
          ) : (
            <>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(['total', 'sent', 'delivered', 'read', 'failed'] as const).map((k) => (
                <div key={k} className="glass-card rounded-2xl p-3 text-center">
                  <div className="text-2xl font-semibold">
                    {k === 'total' ? b.total : (b.counts as any)[k]}
                  </div>
                  <div className="text-xs uppercase text-gray-400">{k}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden glass-card rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/40 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Contact</th>
                    <th className="px-4 py-2">Number</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {b.recipients.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{r.contactName}</td>
                      <td className="px-4 py-2 text-gray-500">{r.waId}</td>
                      <td className="px-4 py-2">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-2 text-xs text-red-600">{r.errorMessage ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

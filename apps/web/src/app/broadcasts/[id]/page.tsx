'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { BroadcastDetail } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppNav } from '@/components/AppNav';

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
    <main className="flex h-screen flex-col bg-gray-100">
      <AppNav />
      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-6">
        <Link href="/broadcasts" className="text-sm text-brand hover:underline">
          ← Back to broadcasts
        </Link>

        {!b ? (
          <div className="mt-6 text-gray-400">Loading…</div>
        ) : (
          <>
            <div className="mb-4 mt-2 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">{b.name}</h1>
                <p className="text-sm text-gray-500">
                  Template <span className="font-medium">{b.template.name}</span> ({b.template.language}) ·{' '}
                  <span className="capitalize">{b.status}</span>
                </p>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(['total', 'sent', 'delivered', 'read', 'failed'] as const).map((k) => (
                <div key={k} className="rounded-lg border bg-white p-3 text-center">
                  <div className="text-2xl font-semibold">
                    {k === 'total' ? b.total : (b.counts as any)[k]}
                  </div>
                  <div className="text-xs uppercase text-gray-400">{k}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
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
    </main>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppNav } from '@/components/AppNav';

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'approved'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected' || status === 'disabled'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-700';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

export default function TemplatesPage() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<TemplateDto[]>('/templates'),
    enabled: ready,
  });

  const sync = useMutation({
    mutationFn: () => api.post<TemplateDto[]>('/templates/sync'),
    onSuccess: (data) => queryClient.setQueryData(['templates'], data),
  });

  const templates = templatesQuery.data ?? [];

  return (
    <main className="flex h-screen flex-col bg-gray-100">
      <AppNav />
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Message Templates</h1>
            <p className="text-sm text-gray-500">
              Approved templates synced from your WhatsApp Business account. Create &amp; submit
              new templates in Meta Business Manager, then sync here.
            </p>
          </div>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {sync.isPending ? 'Syncing…' : 'Sync from Meta'}
          </button>
        </div>

        {sync.isError && (
          <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {(sync.error as Error).message}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Lang</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Variables</th>
                <th className="px-4 py-2">Body</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No templates yet. Click “Sync from Meta”.
                  </td>
                </tr>
              )}
              {templates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2">{t.language}</td>
                  <td className="px-4 py-2 capitalize">{t.category}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2">{t.bodyVarCount}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-gray-500" title={t.bodyText ?? ''}>
                    {t.bodyText ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

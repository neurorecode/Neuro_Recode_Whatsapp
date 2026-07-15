'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/PageHeader';
import { IconClose } from '@/components/icons';

function highlightVars(text: string) {
  return text.split(/(\{\{\s*\d+\s*\}\})/g).map((part, i) =>
    /\{\{\s*\d+\s*\}\}/.test(part) ? (
      <span key={i} className="rounded bg-yellow-200/70 px-1 font-medium text-yellow-900">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function TemplatePreview({ t, onClose }: { t: TemplateDto; onClose: () => void }) {
  return (
    <div
      className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-none items-start justify-between border-b border-white/40 px-5 py-4">
          <div>
            <div className="font-semibold text-gray-900">{t.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
              <span className="uppercase">{t.language}</span>
              <span>·</span>
              <span className="capitalize">{t.category}</span>
              <span>·</span>
              <span>
                {t.bodyVarCount} variable{t.bodyVarCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <IconClose />
          </button>
        </header>
        {/* WhatsApp-style preview */}
        <div className="flex-1 overflow-y-auto bg-white/25 p-5">
          <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 shadow-sm">
            <div className="whitespace-pre-wrap break-words text-sm text-gray-800">
              {t.bodyText ? highlightVars(t.bodyText) : <span className="italic text-gray-400">No body text</span>}
            </div>
            <div className="mt-1 text-right text-[10px] text-gray-400">preview</div>
          </div>
        </div>
        <div className="flex-none border-t border-white/40 px-5 py-3 text-xs text-gray-400">
          Highlighted <span className="rounded bg-yellow-200/70 px-1 text-yellow-900">{'{{n}}'}</span>{' '}
          are variables you fill in when broadcasting.
        </div>
      </div>
    </div>
  );
}

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
  const [preview, setPreview] = useState<TemplateDto | null>(null);

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
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Templates"
          subtitle="Approved templates synced from WhatsApp. Click a row to preview."
          actions={
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="rounded-full bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-60"
            >
              {sync.isPending ? 'Syncing…' : 'Sync from Meta'}
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {sync.isError && (
            <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">
              {(sync.error as Error).message}
            </div>
          )}

          <div className="glass-card overflow-hidden rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/40 text-xs uppercase text-gray-500">
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
                <tr
                  key={t.id}
                  onClick={() => setPreview(t)}
                  className="cursor-pointer border-t transition hover:bg-brand/5"
                >
                  <td className="px-4 py-2 font-medium text-brand-dark">{t.name}</td>
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
      </div>
      {preview && <TemplatePreview t={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { BroadcastListItem, TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppNav } from '@/components/AppNav';

export default function BroadcastsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<TemplateDto[]>('/templates'),
    enabled: ready,
  });
  const tagsQuery = useQuery({
    queryKey: ['contact-tags'],
    queryFn: () => api.get<string[]>('/contacts/tags'),
    enabled: ready,
  });
  const broadcastsQuery = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => api.get<BroadcastListItem[]>('/broadcasts'),
    enabled: ready,
    refetchInterval: 5000,
  });

  const approvedTemplates = (templatesQuery.data ?? []).filter((t) => t.status === 'approved');
  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === templateId),
    [approvedTemplates, templateId],
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const t = approvedTemplates.find((x) => x.id === id);
    setBodyParams(t ? new Array(t.bodyVarCount).fill('') : []);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string }>('/broadcasts', {
        name,
        templateId,
        tags: selectedTags,
        bodyParams,
      });
      router.push(`/broadcasts/${created.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create broadcast');
    } finally {
      setSubmitting(false);
    }
  }

  const broadcasts = broadcastsQuery.data ?? [];

  return (
    <main className="flex h-screen flex-col bg-gray-100">
      <AppNav />
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
        {/* Create */}
        <section className="rounded-lg border bg-white p-5">
          <h1 className="mb-1 text-lg font-semibold">New broadcast</h1>
          <p className="mb-4 text-sm text-gray-500">
            Send an approved template to opted-in contacts, filtered by tag.
          </p>
          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Campaign name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                placeholder="July offer"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Template (approved only)</label>
              <select
                required
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
              >
                <option value="">Select a template…</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
              {approvedTemplates.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  No approved templates yet — sync them on the Templates page.
                </p>
              )}
            </div>

            {selectedTemplate && selectedTemplate.bodyVarCount > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Template variables (applied to every recipient)
                </label>
                {selectedTemplate.bodyText && (
                  <p className="rounded bg-gray-50 p-2 text-xs text-gray-500">
                    {selectedTemplate.bodyText}
                  </p>
                )}
                {bodyParams.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) =>
                      setBodyParams((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder={`{{${i + 1}}}`}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                ))}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">
                Audience tags{' '}
                <span className="font-normal text-gray-400">
                  (opted-in contacts; empty = all opted-in)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(tagsQuery.data ?? []).length === 0 && (
                  <span className="text-xs text-gray-400">
                    No tags yet — add tags to contacts from the Inbox.
                  </span>
                )}
                {(tagsQuery.data ?? []).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      selectedTags.includes(tag)
                        ? 'border-brand bg-brand text-white'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !templateId || !name}
              className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? 'Starting…' : 'Create & send'}
            </button>
          </form>
        </section>

        {/* History */}
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Broadcasts</h2>
          <div className="space-y-2">
            {broadcasts.length === 0 && (
              <p className="text-sm text-gray-400">No broadcasts yet.</p>
            )}
            {broadcasts.map((b) => (
              <Link
                key={b.id}
                href={`/broadcasts/${b.id}`}
                className="block rounded border p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs capitalize text-gray-500">{b.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {b.templateName} · {b.total} recipients · sent {b.counts.sent} · delivered{' '}
                  {b.counts.delivered} · read {b.counts.read} · failed {b.counts.failed}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

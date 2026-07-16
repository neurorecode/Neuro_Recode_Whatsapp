'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentDto, CannedResponseDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useAuth } from '@/lib/auth';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/PageHeader';
import { GlassSelect } from '@/components/GlassSelect';

function AgentsSection({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: () => api.get<AgentDto[]>('/agents') });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/agents', form);
      setForm({ name: '', email: '', password: '', role: 'agent' });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create agent');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="mb-3 text-lg font-semibold">Agents</h2>
      <div className="mb-4 space-y-1">
        {(agentsQuery.data ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-white/50 bg-white/40 px-3 py-2 text-sm">
            <span>
              {a.name} <span className="text-gray-400">· {a.email}</span>
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs capitalize">{a.role}</span>
          </div>
        ))}
      </div>
      {isAdmin ? (
        <form onSubmit={create} className="grid grid-cols-2 gap-2">
          {error && <div className="col-span-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="glass-input rounded-xl px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="glass-input rounded-xl px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Password (min 6)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="glass-input rounded-xl px-3 py-2 text-sm"
          />
          <GlassSelect
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            options={[
              { value: 'agent', label: 'Agent' },
              { value: 'admin', label: 'Admin' },
            ]}
            className="w-full"
          />
          <button
            type="submit"
            disabled={busy}
            className="col-span-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-sm font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add agent'}
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-400">Only admins can add agents.</p>
      )}
    </section>
  );
}

function CannedSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);

  const cannedQuery = useQuery({ queryKey: ['canned'], queryFn: () => api.get<CannedResponseDto[]>('/canned') });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setBusy(true);
    try {
      await api.post('/canned', form);
      setForm({ title: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['canned'] });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/canned/${id}`);
    queryClient.invalidateQueries({ queryKey: ['canned'] });
  }

  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="mb-3 text-lg font-semibold">Quick replies</h2>
      <div className="mb-4 space-y-1">
        {(cannedQuery.data ?? []).length === 0 && (
          <p className="text-xs text-gray-400">No quick replies yet.</p>
        )}
        {(cannedQuery.data ?? []).map((c) => (
          <div key={c.id} className="rounded-xl border border-white/50 bg-white/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.title}</span>
              <button
                onClick={() => remove(c.id)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Delete
              </button>
            </div>
            <div className="text-gray-500">{c.body}</div>
          </div>
        ))}
      </div>
      <form onSubmit={create} className="space-y-2">
        <input
          placeholder="Title (e.g. Greeting)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full glass-input rounded-xl px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Reply text"
          value={form.body}
          rows={3}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="w-full glass-input rounded-xl px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add quick reply'}
        </button>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const { ready } = useRequireAuth();
  const agent = useAuth((s) => s.agent);

  if (!ready) {
    return <main className="flex h-screen items-center justify-center text-gray-500">Loading…</main>;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="page-transition flex flex-1 flex-col overflow-hidden">
        <PageHeader title="Settings" subtitle="Manage agents and quick replies." />
        <div className="grid flex-1 gap-6 overflow-y-auto px-8 pb-8 md:grid-cols-2">
          <AgentsSection isAdmin={agent?.role === 'admin'} />
          <CannedSection />
        </div>
      </div>
    </div>
  );
}

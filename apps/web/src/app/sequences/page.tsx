'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useAuth } from '@/lib/auth';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/PageHeader';
import { GlassSelect } from '@/components/GlassSelect';

type Step = { delayHours: number; templateId: string; bodyParams: string[] };
type Sequence = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  triggerTag: string | null;
  keywords: string[];
  enrolled: number;
  steps: { id: string; order: number; delayHours: number; templateId: string; templateName: string; bodyParams: string[] }[];
};

const TRIGGERS = [
  { value: 'manual', label: 'Manual (enroll by tag)' },
  { value: 'first_contact', label: 'On first contact' },
  { value: 'keyword', label: 'On keyword' },
];

function NewSequence({ templates, onCreated }: { templates: TemplateDto[]; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('manual');
  const [triggerTag, setTriggerTag] = useState('');
  const [keywords, setKeywords] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ delayHours: 0, templateId: '', bodyParams: [] }]);
  const [error, setError] = useState<string | null>(null);
  const approved = templates.filter((t) => t.status === 'approved');

  function setStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function onStepTemplate(i: number, templateId: string) {
    const t = approved.find((x) => x.id === templateId);
    setStep(i, { templateId, bodyParams: t ? new Array(t.bodyVarCount).fill('') : [] });
  }

  const create = useMutation({
    mutationFn: () =>
      api.post('/sequences', {
        name,
        trigger,
        triggerTag: trigger === 'manual' ? null : triggerTag || null,
        keywords: trigger === 'keyword' ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
        steps,
      }),
    onSuccess: () => {
      setName('');
      setSteps([{ delayHours: 0, templateId: '', bodyParams: [] }]);
      setKeywords('');
      onCreated();
    },
    onError: (e: any) => setError(e?.message ?? 'Failed to create sequence'),
  });

  const valid = name.trim() && steps.every((s) => s.templateId);

  return (
    <section className="glass-card rounded-3xl p-5">
      <h2 className="mb-3 text-lg font-semibold">New sequence</h2>
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome journey" className="w-full glass-input rounded-xl px-3 py-2" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Enrollment trigger</label>
            <GlassSelect value={trigger} onChange={setTrigger} options={TRIGGERS} className="w-full" />
          </div>
          {trigger === 'keyword' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Keywords (comma-separated)</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="join, start" className="w-full glass-input rounded-xl px-3 py-2" />
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Steps</label>
            <span className="text-xs text-gray-400">Each step sends an approved template after a delay</span>
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => {
              const t = approved.find((x) => x.id === s.templateId);
              return (
                <div key={i} className="rounded-xl border border-white/50 bg-white/40 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">Step {i + 1}</span>
                    <span className="text-xs text-gray-400">· send after</span>
                    <input
                      type="number"
                      min={0}
                      value={s.delayHours}
                      onChange={(e) => setStep(i, { delayHours: Number(e.target.value) })}
                      className="glass-input w-16 rounded-lg px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-gray-400">hours</span>
                    {steps.length > 1 && (
                      <button onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))} className="ml-auto text-xs text-gray-400 hover:text-red-500">
                        Remove
                      </button>
                    )}
                  </div>
                  <GlassSelect
                    value={s.templateId}
                    onChange={(v) => onStepTemplate(i, v)}
                    options={approved.map((tp) => ({ value: tp.id, label: `${tp.name} (${tp.language})`, hint: tp.category.toUpperCase() }))}
                    placeholder="Choose a template…"
                    className="w-full"
                  />
                  {t && t.bodyVarCount > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {s.bodyParams.map((v, vi) => (
                        <input
                          key={vi}
                          value={v}
                          onChange={(e) => setStep(i, { bodyParams: s.bodyParams.map((x, xi) => (xi === vi ? e.target.value : x)) })}
                          placeholder={`{{${vi + 1}}}`}
                          className="w-full glass-input rounded-lg px-3 py-1.5 text-sm"
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setSteps((p) => [...p, { delayHours: 24, templateId: '', bodyParams: [] }])}
            className="mt-2 rounded-lg border border-dashed border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-dark hover:bg-white/50"
          >
            + Add step
          </button>
        </div>

        <button
          onClick={() => valid && create.mutate()}
          disabled={!valid || create.isPending}
          className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create sequence'}
        </button>
      </div>
    </section>
  );
}

function SequenceRow({ s, onChange }: { s: Sequence; onChange: () => void }) {
  const [tag, setTag] = useState('');
  const [enrollMsg, setEnrollMsg] = useState('');

  async function toggle() {
    await api.patch(`/sequences/${s.id}/enabled`, { enabled: !s.enabled });
    onChange();
  }
  async function remove() {
    await api.del(`/sequences/${s.id}`);
    onChange();
  }
  async function enroll() {
    if (!tag.trim()) return;
    const res = await api.post<{ enrolled: number }>(`/sequences/${s.id}/enroll`, { tag: tag.trim() });
    setEnrollMsg(`Enrolled ${res.enrolled}`);
    setTag('');
    setTimeout(() => setEnrollMsg(''), 2500);
    onChange();
  }

  return (
    <div className="rounded-2xl border border-white/50 bg-white/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{s.name}</div>
          <div className="text-xs text-gray-400">
            {s.trigger === 'keyword' ? `keyword: ${s.keywords.join(', ')}` : s.trigger.replace('_', ' ')} · {s.steps.length} steps · {s.enrolled} enrolled
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className={`rounded-full px-3 py-1 text-xs font-medium ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
          >
            {s.enabled ? 'Active' : 'Paused'}
          </button>
          <button onClick={remove} className="text-xs text-gray-400 hover:text-red-500">
            Delete
          </button>
        </div>
      </div>

      <ol className="mt-3 space-y-1">
        {s.steps.map((st, i) => (
          <li key={st.id} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/15 text-[10px] font-semibold text-brand-dark">{i + 1}</span>
            <span className="text-gray-400">+{st.delayHours}h →</span>
            <span className="font-medium">{st.templateName}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-center gap-2">
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Enroll contacts by tag…" className="flex-1 glass-input rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={enroll} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
          Enroll
        </button>
        {enrollMsg && <span className="text-xs text-green-600">{enrollMsg}</span>}
      </div>
    </div>
  );
}

export default function SequencesPage() {
  const { ready } = useRequireAuth();
  const agent = useAuth((s) => s.agent);
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({ queryKey: ['templates'], queryFn: () => api.get<TemplateDto[]>('/templates'), enabled: ready });
  const seqQuery = useQuery({ queryKey: ['sequences'], queryFn: () => api.get<Sequence[]>('/sequences'), enabled: ready });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sequences'] });
  const sequences = seqQuery.data ?? [];
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const isAdmin = agent?.role === 'admin';

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="page-transition flex flex-1 flex-col overflow-hidden">
        <PageHeader title="Sequences" subtitle="Automated multi-step drip campaigns using approved templates." />
        <div className="grid flex-1 auto-rows-min gap-6 overflow-y-auto px-8 pb-8 md:grid-cols-2">
          {isAdmin ? (
            <NewSequence templates={templates} onCreated={refresh} />
          ) : (
            <section className="glass-card rounded-3xl p-5 text-sm text-gray-400">
              Only admins can create sequences.
            </section>
          )}
          <section className="glass-card rounded-3xl p-5">
            <h2 className="mb-3 text-lg font-semibold">Your sequences</h2>
            <div className="space-y-3">
              {sequences.length === 0 && <p className="text-sm text-gray-400">No sequences yet.</p>}
              {sequences.map((s) => (
                <SequenceRow key={s.id} s={s} onChange={refresh} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useAuth } from '@/lib/auth';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/PageHeader';
import { GlassSelect } from '@/components/GlassSelect';

type NodeType =
  | 'message' | 'buttons' | 'list' | 'question' | 'condition'
  | 'delay' | 'tag' | 'template' | 'handoff' | 'end';
type FlowNode = { id: string; type: NodeType; data: any; next?: string | null };
type Flow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  keywords: string[];
  graph: { nodes: FlowNode[] };
  startNodeId: string | null;
};

const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'message', label: 'Send message' },
  { value: 'buttons', label: 'Ask with buttons' },
  { value: 'list', label: 'Ask with list' },
  { value: 'question', label: 'Ask & capture answer' },
  { value: 'condition', label: 'Branch on answer' },
  { value: 'template', label: 'Send template' },
  { value: 'delay', label: 'Wait' },
  { value: 'tag', label: 'Add tag' },
  { value: 'handoff', label: 'Hand off to agent' },
  { value: 'end', label: 'End' },
];
const TYPE_LABEL = Object.fromEntries(NODE_TYPES.map((t) => [t.value, t.label]));
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.round(Math.random() * 1e6)}`);

function defaultData(type: NodeType): any {
  switch (type) {
    case 'buttons': return { text: '', options: [{ id: uid(), title: '', next: null }] };
    case 'list': return { text: '', buttonText: 'Choose', options: [{ id: uid(), title: '', description: '', next: null }] };
    case 'question': return { text: '', varName: '' };
    case 'condition': return { varName: '', cases: [{ value: '', next: null }], defaultNext: null };
    case 'delay': return { minutes: 60 };
    case 'tag': return { tag: '' };
    case 'template': return { templateId: '', bodyParams: [] };
    case 'handoff': return { text: 'An agent will be with you shortly.' };
    case 'message': return { text: '' };
    default: return {};
  }
}

function nodeSummary(n: FlowNode): string {
  if (n.type === 'tag') return n.data?.tag || '';
  if (n.type === 'delay') return `${n.data?.minutes ?? 0}m`;
  if (n.type === 'template') return 'template';
  return (n.data?.text || '').slice(0, 24);
}

function FlowBuilder({
  initial,
  templates,
  onDone,
  onCancel,
}: {
  initial: Flow | null;
  templates: TemplateDto[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [trigger, setTrigger] = useState(initial?.trigger ?? 'keyword');
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(', '));
  const [nodes, setNodes] = useState<FlowNode[]>(initial?.graph?.nodes ?? []);
  const [startNodeId, setStartNodeId] = useState<string | null>(initial?.startNodeId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approved = templates.filter((t) => t.status === 'approved');

  function addNode(type: NodeType) {
    const node: FlowNode = { id: uid(), type, data: defaultData(type), next: null };
    setNodes((p) => [...p, node]);
    if (!startNodeId) setStartNodeId(node.id);
  }
  function patchNode(id: string, patch: Partial<FlowNode>) {
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }
  function patchData(id: string, dataPatch: any) {
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...dataPatch } } : n)));
  }
  function removeNode(id: string) {
    setNodes((p) => p.filter((n) => n.id !== id));
    if (startNodeId === id) setStartNodeId(null);
  }

  const nextOptions = (selfId: string) => [
    { value: '', label: '→ End' },
    ...nodes.filter((n) => n.id !== selfId).map((n) => ({
      value: n.id,
      label: `${TYPE_LABEL[n.type]}${nodeSummary(n) ? ` · ${nodeSummary(n)}` : ''}`,
    })),
  ];

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Give the flow a name.');
    if (nodes.length === 0) return setError('Add at least one step.');
    if (!startNodeId) return setError('Pick the starting step.');
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        trigger,
        keywords: trigger === 'keyword' ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
        graph: { nodes },
        startNodeId,
        enabled: initial?.enabled ?? false,
      };
      if (initial) await api.put(`/flows/${initial.id}`, payload);
      else await api.post('/flows', payload);
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save flow');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-card rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{initial ? 'Edit chatbot' : 'New chatbot'}</h2>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="FAQ bot" className="w-full glass-input rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Trigger</label>
            <GlassSelect
              value={trigger}
              onChange={setTrigger}
              options={[
                { value: 'keyword', label: 'On keyword' },
                { value: 'first_contact', label: 'On first contact' },
                { value: 'manual', label: 'Manual only' },
              ]}
              className="w-full"
            />
          </div>
        </div>
        {trigger === 'keyword' && (
          <div>
            <label className="mb-1 block text-sm font-medium">Keywords (comma-separated)</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="hi, help, menu" className="w-full glass-input rounded-xl px-3 py-2" />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Start step</label>
          <GlassSelect
            value={startNodeId ?? ''}
            onChange={(v) => setStartNodeId(v || null)}
            options={nodes.map((n) => ({ value: n.id, label: `${TYPE_LABEL[n.type]}${nodeSummary(n) ? ` · ${nodeSummary(n)}` : ''}` }))}
            placeholder="Add steps first…"
            className="w-full"
          />
        </div>

        {/* Nodes */}
        <div className="space-y-3">
          {nodes.map((n) => (
            <div key={n.id} className="rounded-2xl border border-white/50 bg-white/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                  {TYPE_LABEL[n.type]}
                  {startNodeId === n.id ? ' · start' : ''}
                </span>
                <button onClick={() => removeNode(n.id)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
              </div>

              {/* Config per type */}
              {(n.type === 'message' || n.type === 'handoff') && (
                <textarea rows={2} value={n.data.text} onChange={(e) => patchData(n.id, { text: e.target.value })} placeholder="Message text" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
              )}

              {n.type === 'question' && (
                <div className="space-y-2">
                  <textarea rows={2} value={n.data.text} onChange={(e) => patchData(n.id, { text: e.target.value })} placeholder="Question to ask" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
                  <input value={n.data.varName} onChange={(e) => patchData(n.id, { varName: e.target.value })} placeholder="Save answer as (variable name)" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
                </div>
              )}

              {n.type === 'tag' && (
                <input value={n.data.tag} onChange={(e) => patchData(n.id, { tag: e.target.value })} placeholder="Tag to add" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
              )}

              {n.type === 'delay' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Wait</span>
                  <input type="number" min={1} value={n.data.minutes} onChange={(e) => patchData(n.id, { minutes: Number(e.target.value) })} className="glass-input w-20 rounded-lg px-2 py-1" />
                  <span className="text-gray-500">minutes</span>
                </div>
              )}

              {n.type === 'template' && (
                <GlassSelect
                  value={n.data.templateId}
                  onChange={(v) => patchData(n.id, { templateId: v })}
                  options={approved.map((t) => ({ value: t.id, label: `${t.name} (${t.language})`, hint: t.category.toUpperCase() }))}
                  placeholder="Choose a template…"
                  className="w-full"
                />
              )}

              {(n.type === 'buttons' || n.type === 'list') && (
                <div className="space-y-2">
                  <textarea rows={2} value={n.data.text} onChange={(e) => patchData(n.id, { text: e.target.value })} placeholder="Prompt text" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
                  {n.type === 'list' && (
                    <input value={n.data.buttonText} onChange={(e) => patchData(n.id, { buttonText: e.target.value })} placeholder="List button label" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
                  )}
                  <div className="space-y-2">
                    {(n.data.options as any[]).map((o, oi) => (
                      <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/40 p-2">
                        <input
                          value={o.title}
                          onChange={(e) => patchData(n.id, { options: n.data.options.map((x: any, xi: number) => (xi === oi ? { ...x, title: e.target.value } : x)) })}
                          placeholder={`Option ${oi + 1}`}
                          className="glass-input min-w-[120px] flex-1 rounded-lg px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-gray-400">then</span>
                        <GlassSelect
                          value={o.next ?? ''}
                          onChange={(v) => patchData(n.id, { options: n.data.options.map((x: any, xi: number) => (xi === oi ? { ...x, next: v || null } : x)) })}
                          options={nextOptions(n.id)}
                          className="w-40"
                        />
                        <button onClick={() => patchData(n.id, { options: n.data.options.filter((_: any, xi: number) => xi !== oi) })} className="text-xs text-gray-400 hover:text-red-500">×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => patchData(n.id, { options: [...n.data.options, { id: uid(), title: '', next: null }] })}
                      className="rounded-lg border border-dashed border-brand/40 px-2 py-1 text-xs font-medium text-brand-dark hover:bg-white/50"
                    >
                      + Add option
                    </button>
                  </div>
                </div>
              )}

              {n.type === 'condition' && (
                <div className="space-y-2">
                  <input value={n.data.varName} onChange={(e) => patchData(n.id, { varName: e.target.value })} placeholder="Variable to check" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
                  {(n.data.cases as any[]).map((c, ci) => (
                    <div key={ci} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/40 p-2">
                      <span className="text-xs text-gray-400">if =</span>
                      <input value={c.value} onChange={(e) => patchData(n.id, { cases: n.data.cases.map((x: any, xi: number) => (xi === ci ? { ...x, value: e.target.value } : x)) })} placeholder="value" className="glass-input w-28 rounded-lg px-2 py-1 text-sm" />
                      <span className="text-xs text-gray-400">then</span>
                      <GlassSelect value={c.next ?? ''} onChange={(v) => patchData(n.id, { cases: n.data.cases.map((x: any, xi: number) => (xi === ci ? { ...x, next: v || null } : x)) })} options={nextOptions(n.id)} className="w-36" />
                      <button onClick={() => patchData(n.id, { cases: n.data.cases.filter((_: any, xi: number) => xi !== ci) })} className="text-xs text-gray-400 hover:text-red-500">×</button>
                    </div>
                  ))}
                  <button onClick={() => patchData(n.id, { cases: [...n.data.cases, { value: '', next: null }] })} className="rounded-lg border border-dashed border-brand/40 px-2 py-1 text-xs font-medium text-brand-dark hover:bg-white/50">+ Add case</button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">otherwise</span>
                    <GlassSelect value={n.data.defaultNext ?? ''} onChange={(v) => patchData(n.id, { defaultNext: v || null })} options={nextOptions(n.id)} className="w-40" />
                  </div>
                </div>
              )}

              {/* linear "next" selector */}
              {['message', 'question', 'tag', 'delay', 'template'].includes(n.type) && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">then →</span>
                  <GlassSelect value={n.next ?? ''} onChange={(v) => patchNode(n.id, { next: v || null })} options={nextOptions(n.id)} className="w-48" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add-node palette */}
        <div className="flex flex-wrap gap-2">
          {NODE_TYPES.map((t) => (
            <button key={t.value} onClick={() => addNode(t.value)} className="rounded-lg border border-white/60 bg-white/50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-white/80">
              + {t.label}
            </button>
          ))}
        </div>

        <button onClick={save} disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50">
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create chatbot'}
        </button>
      </div>
    </section>
  );
}

export default function FlowsPage() {
  const { ready } = useRequireAuth();
  const agent = useAuth((s) => s.agent);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Flow | null | 'new'>(null);

  const flowsQuery = useQuery({ queryKey: ['flows'], queryFn: () => api.get<Flow[]>('/flows'), enabled: ready });
  const templatesQuery = useQuery({ queryKey: ['templates'], queryFn: () => api.get<TemplateDto[]>('/templates'), enabled: ready });
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['flows'] });
  const isAdmin = agent?.role === 'admin';

  async function toggle(f: Flow) {
    await api.patch(`/flows/${f.id}/enabled`, { enabled: !f.enabled });
    refresh();
  }
  async function remove(id: string) {
    await api.del(`/flows/${id}`);
    refresh();
  }

  const flows = flowsQuery.data ?? [];

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="page-transition flex flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Chatbot"
          subtitle="No-code WhatsApp flows — greet, ask, branch on button taps, and hand off to an agent."
          actions={
            isAdmin && editing === null ? (
              <button onClick={() => setEditing('new')} className="rounded-full bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/30 hover:shadow-brand/40">
                + New chatbot
              </button>
            ) : undefined
          }
        />
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {editing !== null ? (
            <FlowBuilder
              initial={editing === 'new' ? null : editing}
              templates={templates}
              onDone={() => { setEditing(null); refresh(); }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {flows.length === 0 && <p className="text-sm text-gray-400">No chatbots yet.</p>}
              {flows.map((f) => (
                <div key={f.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{f.name}</div>
                      <div className="text-xs text-gray-400">
                        {f.trigger === 'keyword' ? `keyword: ${f.keywords.join(', ')}` : f.trigger.replace('_', ' ')} · {f.graph?.nodes?.length ?? 0} steps
                      </div>
                    </div>
                    <button onClick={() => toggle(f)} className={`rounded-full px-3 py-1 text-xs font-medium ${f.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {f.enabled ? 'Active' : 'Paused'}
                    </button>
                  </div>
                  {isAdmin && (
                    <div className="mt-3 flex gap-3 text-xs">
                      <button onClick={() => setEditing(f)} className="font-medium text-brand-dark hover:underline">Edit</button>
                      <button onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-500">Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

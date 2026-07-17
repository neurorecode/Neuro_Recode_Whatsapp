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
import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { NodeConfig } from '@/components/flow/NodeConfig';
import { FlowNode, NodeType, NODE_TYPES, TYPE_LABEL, defaultData, nodeSummary, uid } from '@/components/flow/shared';

type Flow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  keywords: string[];
  graph: { nodes: FlowNode[] };
  startNodeId: string | null;
};

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
  const [view, setView] = useState<'canvas' | 'steps'>('canvas');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function addNode(type: NodeType) {
    const node: FlowNode = { id: uid(), type, data: defaultData(type), next: null };
    setNodes((p) => [...p, node]);
    if (!startNodeId) setStartNodeId(node.id);
    setSelectedId(node.id);
  }
  const patchNode = (id: string, patch: Partial<FlowNode>) =>
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const patchData = (id: string, dataPatch: any) =>
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...dataPatch } } : n)));
  function removeNode(id: string) {
    setNodes((p) => p.filter((n) => n.id !== id));
    if (startNodeId === id) setStartNodeId(null);
    if (selectedId === id) setSelectedId(null);
  }

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

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <section className="glass-card rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{initial ? 'Edit chatbot' : 'New chatbot'}</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-white/50 p-0.5 text-xs ring-1 ring-white/60">
            <button onClick={() => setView('canvas')} className={`rounded-full px-3 py-1 font-medium ${view === 'canvas' ? 'bg-brand text-white' : 'text-gray-600'}`}>Canvas</button>
            <button onClick={() => setView('steps')} className={`rounded-full px-3 py-1 font-medium ${view === 'steps' ? 'bg-brand text-white' : 'text-gray-600'}`}>Steps</button>
          </div>
          <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      {/* Flow meta */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chatbot name" className="glass-input rounded-xl px-3 py-2" />
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
        {trigger === 'keyword' ? (
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords: hi, help" className="glass-input rounded-xl px-3 py-2" />
        ) : (
          <div />
        )}
      </div>

      {/* Add-node palette */}
      <div className="mb-3 flex flex-wrap gap-2">
        {NODE_TYPES.map((t) => (
          <button key={t.value} onClick={() => addNode(t.value)} className="rounded-lg border border-white/60 bg-white/50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-white/80">
            + {t.label}
          </button>
        ))}
      </div>

      {view === 'canvas' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <FlowCanvas nodes={nodes} setNodes={setNodes} startNodeId={startNodeId} selectedId={selectedId} onSelect={setSelectedId} />
          {/* Config panel */}
          <div className="rounded-2xl border border-white/50 bg-white/30 p-4">
            {selected ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">{TYPE_LABEL[selected.type]}</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setStartNodeId(selected.id)} className={`font-medium ${startNodeId === selected.id ? 'text-green-600' : 'text-brand-dark hover:underline'}`}>
                      {startNodeId === selected.id ? '✓ start' : 'Set start'}
                    </button>
                    <button onClick={() => removeNode(selected.id)} className="text-gray-400 hover:text-red-500">Remove</button>
                  </div>
                </div>
                <NodeConfig node={selected} nodes={nodes} templates={templates} patchNode={patchNode} patchData={patchData} showNext={false} />
                <p className="mt-3 text-[11px] text-gray-400">Drag from a node's bottom dot to another node to connect the path.</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Add a step from the palette, then click a node to configure it. Drag between nodes to connect them.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
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
          {nodes.map((n) => (
            <div key={n.id} className="rounded-2xl border border-white/50 bg-white/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                  {TYPE_LABEL[n.type]}{startNodeId === n.id ? ' · start' : ''}
                </span>
                <button onClick={() => removeNode(n.id)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
              </div>
              <NodeConfig node={n} nodes={nodes} templates={templates} patchNode={patchNode} patchData={patchData} showNext />
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50">
        {busy ? 'Saving…' : initial ? 'Save changes' : 'Create chatbot'}
      </button>
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

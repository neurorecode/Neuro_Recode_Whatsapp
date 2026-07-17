'use client';

import type { TemplateDto } from '@nrw/shared';
import { GlassSelect } from '../GlassSelect';
import { FlowNode, TYPE_LABEL, LINEAR_TYPES, nodeSummary, uid } from './shared';

export function NodeConfig({
  node,
  nodes,
  templates,
  patchNode,
  patchData,
  showNext = true,
}: {
  node: FlowNode;
  nodes: FlowNode[];
  templates: TemplateDto[];
  patchNode: (id: string, patch: Partial<FlowNode>) => void;
  patchData: (id: string, dataPatch: any) => void;
  showNext?: boolean;
}) {
  const approved = templates.filter((t) => t.status === 'approved');
  const n = node;

  const nextOptions = [
    { value: '', label: '→ End' },
    ...nodes.filter((x) => x.id !== n.id).map((x) => ({
      value: x.id,
      label: `${TYPE_LABEL[x.type]}${nodeSummary(x) ? ` · ${nodeSummary(x)}` : ''}`,
    })),
  ];

  return (
    <div className="space-y-2">
      {(n.type === 'message' || n.type === 'handoff') && (
        <textarea rows={2} value={n.data.text} onChange={(e) => patchData(n.id, { text: e.target.value })} placeholder="Message text" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
      )}

      {n.type === 'question' && (
        <>
          <textarea rows={2} value={n.data.text} onChange={(e) => patchData(n.id, { text: e.target.value })} placeholder="Question to ask" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          <input value={n.data.varName} onChange={(e) => patchData(n.id, { varName: e.target.value })} placeholder="Save answer as (variable)" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
        </>
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
        <>
          <textarea rows={2} value={n.data.text} onChange={(e) => patchData(n.id, { text: e.target.value })} placeholder="Prompt text" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          {n.type === 'list' && (
            <input value={n.data.buttonText} onChange={(e) => patchData(n.id, { buttonText: e.target.value })} placeholder="List button label" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          )}
          {(n.data.options as any[]).map((o, oi) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/40 p-2">
              <input
                value={o.title}
                onChange={(e) => patchData(n.id, { options: n.data.options.map((x: any, xi: number) => (xi === oi ? { ...x, title: e.target.value } : x)) })}
                placeholder={`Option ${oi + 1}`}
                className="glass-input min-w-[110px] flex-1 rounded-lg px-2 py-1 text-sm"
              />
              {showNext && (
                <>
                  <span className="text-xs text-gray-400">then</span>
                  <GlassSelect
                    value={o.next ?? ''}
                    onChange={(v) => patchData(n.id, { options: n.data.options.map((x: any, xi: number) => (xi === oi ? { ...x, next: v || null } : x)) })}
                    options={nextOptions}
                    className="w-36"
                  />
                </>
              )}
              <button onClick={() => patchData(n.id, { options: n.data.options.filter((_: any, xi: number) => xi !== oi) })} className="text-xs text-gray-400 hover:text-red-500">×</button>
            </div>
          ))}
          <button onClick={() => patchData(n.id, { options: [...n.data.options, { id: uid(), title: '', next: null }] })} className="rounded-lg border border-dashed border-brand/40 px-2 py-1 text-xs font-medium text-brand-dark hover:bg-white/50">+ Add option</button>
        </>
      )}

      {n.type === 'condition' && (
        <>
          <input value={n.data.varName} onChange={(e) => patchData(n.id, { varName: e.target.value })} placeholder="Variable to check" className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          {(n.data.cases as any[]).map((c, ci) => (
            <div key={ci} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/40 p-2">
              <span className="text-xs text-gray-400">if =</span>
              <input value={c.value} onChange={(e) => patchData(n.id, { cases: n.data.cases.map((x: any, xi: number) => (xi === ci ? { ...x, value: e.target.value } : x)) })} placeholder="value" className="glass-input w-24 rounded-lg px-2 py-1 text-sm" />
              {showNext && (
                <>
                  <span className="text-xs text-gray-400">then</span>
                  <GlassSelect value={c.next ?? ''} onChange={(v) => patchData(n.id, { cases: n.data.cases.map((x: any, xi: number) => (xi === ci ? { ...x, next: v || null } : x)) })} options={nextOptions} className="w-32" />
                </>
              )}
              <button onClick={() => patchData(n.id, { cases: n.data.cases.filter((_: any, xi: number) => xi !== ci) })} className="text-xs text-gray-400 hover:text-red-500">×</button>
            </div>
          ))}
          <button onClick={() => patchData(n.id, { cases: [...n.data.cases, { value: '', next: null }] })} className="rounded-lg border border-dashed border-brand/40 px-2 py-1 text-xs font-medium text-brand-dark hover:bg-white/50">+ Add case</button>
          {showNext && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">otherwise</span>
              <GlassSelect value={n.data.defaultNext ?? ''} onChange={(v) => patchData(n.id, { defaultNext: v || null })} options={nextOptions} className="w-36" />
            </div>
          )}
        </>
      )}

      {showNext && LINEAR_TYPES.includes(n.type) && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">then →</span>
          <GlassSelect value={n.next ?? ''} onChange={(v) => patchNode(n.id, { next: v || null })} options={nextOptions} className="w-48" />
        </div>
      )}
    </div>
  );
}

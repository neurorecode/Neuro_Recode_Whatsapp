'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FlowNode, TYPE_LABEL, LINEAR_TYPES, nodeSummary } from './shared';

const HAS_NO_OUTPUT = ['handoff', 'end'];

// ---- Custom node box ----
function FlowNodeBox({ data, selected }: NodeProps) {
  const node = (data as any).node as FlowNode;
  const isStart = (data as any).isStart as boolean;
  const options: any[] = node.data?.options ?? [];
  const cases: any[] = node.data?.cases ?? [];

  let sourceHandles: { id: string; label: string }[] = [];
  if (LINEAR_TYPES.includes(node.type)) sourceHandles = [{ id: 'out', label: '' }];
  else if (node.type === 'buttons' || node.type === 'list')
    sourceHandles = options.map((o, i) => ({ id: o.id, label: o.title || `#${i + 1}` }));
  else if (node.type === 'condition')
    sourceHandles = [
      ...cases.map((c, i) => ({ id: `case-${i}`, label: c.value || `#${i + 1}` })),
      { id: 'default', label: 'else' },
    ];

  return (
    <div
      className={`min-w-[170px] rounded-xl border bg-white/85 px-3 py-2 shadow-md backdrop-blur transition ${
        selected ? 'border-brand ring-2 ring-brand/40' : 'border-white/70'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !bg-brand" />
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-dark">
          {TYPE_LABEL[node.type]}
        </span>
        {isStart && <span className="text-[10px] font-semibold text-green-600">start</span>}
      </div>
      {nodeSummary(node) && (
        <div className="mt-1 max-w-[200px] truncate text-xs text-gray-600">{nodeSummary(node)}</div>
      )}
      {!HAS_NO_OUTPUT.includes(node.type) &&
        sourceHandles.map((h, i) => {
          const left = `${((i + 1) / (sourceHandles.length + 1)) * 100}%`;
          return (
            <Handle
              key={h.id}
              id={h.id}
              type="source"
              position={Position.Bottom}
              style={{ left }}
              className="!h-2.5 !w-2.5 !bg-gray-400"
            >
              {h.label && sourceHandles.length > 1 && (
                <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[9px] text-gray-400">
                  {h.label.slice(0, 10)}
                </span>
              )}
            </Handle>
          );
        })}
    </div>
  );
}

const nodeTypes = { flow: FlowNodeBox };

function autoPos(i: number) {
  return { x: 120 + (i % 3) * 240, y: 40 + Math.floor(i / 3) * 150 };
}

function deriveEdges(nodes: FlowNode[]): Edge[] {
  const edges: Edge[] = [];
  const push = (source: string, handle: string, target?: string | null) => {
    if (target) edges.push({ id: `${source}:${handle}->${target}`, source, sourceHandle: handle, target, animated: true });
  };
  for (const n of nodes) {
    if (LINEAR_TYPES.includes(n.type)) push(n.id, 'out', n.next);
    else if (n.type === 'buttons' || n.type === 'list')
      (n.data?.options ?? []).forEach((o: any) => push(n.id, o.id, o.next));
    else if (n.type === 'condition') {
      (n.data?.cases ?? []).forEach((c: any, i: number) => push(n.id, `case-${i}`, c.next));
      push(n.id, 'default', n.data?.defaultNext);
    }
  }
  return edges;
}

export function FlowCanvas({
  nodes,
  setNodes,
  startNodeId,
  selectedId,
  onSelect,
}: {
  nodes: FlowNode[];
  setNodes: (updater: (prev: FlowNode[]) => FlowNode[]) => void;
  startNodeId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const initialRfNodes = useMemo<Node[]>(
    () =>
      nodes.map((n, i) => ({
        id: n.id,
        type: 'flow',
        position: n.position ?? autoPos(i),
        data: { node: n, isStart: startNodeId === n.id },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialRfNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(deriveEdges(nodes));

  // Re-sync node boxes + edges when the underlying config changes, keeping positions.
  useEffect(() => {
    setRfNodes((prev) => {
      const posById = new Map(prev.map((p) => [p.id, p.position]));
      return nodes.map((n, i) => ({
        id: n.id,
        type: 'flow',
        position: posById.get(n.id) ?? n.position ?? autoPos(i),
        selected: n.id === selectedId,
        data: { node: n, isStart: startNodeId === n.id },
      }));
    });
    setRfEdges(deriveEdges(nodes));
  }, [nodes, startNodeId, selectedId, setRfNodes, setRfEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || !c.sourceHandle) return;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== c.source) return n;
          const h = c.sourceHandle!;
          if (h === 'out') return { ...n, next: c.target };
          if (n.type === 'buttons' || n.type === 'list')
            return { ...n, data: { ...n.data, options: n.data.options.map((o: any) => (o.id === h ? { ...o, next: c.target } : o)) } };
          if (n.type === 'condition') {
            if (h === 'default') return { ...n, data: { ...n.data, defaultNext: c.target } };
            const idx = Number(h.replace('case-', ''));
            return { ...n, data: { ...n.data, cases: n.data.cases.map((x: any, i: number) => (i === idx ? { ...x, next: c.target } : x)) } };
          }
          return n;
        }),
      );
    },
    [setNodes],
  );

  const onNodeDragStop = useCallback(
    (_e: unknown, node: Node) => {
      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, position: node.position } : n)));
    },
    [setNodes],
  );

  return (
    <div className="h-[540px] overflow-hidden rounded-2xl border border-white/50 bg-white/20">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_e, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#c4b5fd" gap={18} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

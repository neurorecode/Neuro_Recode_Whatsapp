export type NodeType =
  | 'message' | 'buttons' | 'list' | 'question' | 'condition'
  | 'delay' | 'tag' | 'template' | 'handoff' | 'end';

export type FlowNode = {
  id: string;
  type: NodeType;
  data: any;
  next?: string | null;
  position?: { x: number; y: number };
};

export const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'message', label: 'Send message' },
  { value: 'buttons', label: 'Ask with buttons' },
  { value: 'list', label: 'Ask with list' },
  { value: 'question', label: 'Ask & capture' },
  { value: 'condition', label: 'Branch' },
  { value: 'template', label: 'Send template' },
  { value: 'delay', label: 'Wait' },
  { value: 'tag', label: 'Add tag' },
  { value: 'handoff', label: 'Hand off' },
  { value: 'end', label: 'End' },
];

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  NODE_TYPES.map((t) => [t.value, t.label]),
);

// Node types that branch into multiple paths (each with its own edge handle).
export const LINEAR_TYPES: NodeType[] = ['message', 'question', 'tag', 'delay', 'template'];

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}${Math.round(Math.random() * 1e6)}`;

export function defaultData(type: NodeType): any {
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

export function nodeSummary(n: FlowNode): string {
  if (n.type === 'tag') return n.data?.tag || '';
  if (n.type === 'delay') return `${n.data?.minutes ?? 0}m`;
  if (n.type === 'template') return 'template';
  if (n.type === 'condition') return n.data?.varName || '';
  return (n.data?.text || '').slice(0, 28);
}

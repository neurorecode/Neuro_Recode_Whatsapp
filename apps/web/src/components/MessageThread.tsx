'use client';

import { useEffect, useRef } from 'react';
import type { MessageDto } from '@nrw/shared';

function statusTick(status: string): string {
  switch (status) {
    case 'read':
      return '✓✓';
    case 'delivered':
      return '✓✓';
    case 'sent':
      return '✓';
    case 'failed':
      return '⚠';
    default:
      return '🕓';
  }
}

export function MessageThread({ messages }: { messages: MessageDto[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
      {messages.map((m) => {
        const outbound = m.direction === 'outbound';
        return (
          <div key={m.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                outbound ? 'bg-[#d9fdd3]' : 'bg-white'
              }`}
            >
              {m.type !== 'text' && (
                <div className="mb-1 text-xs font-medium uppercase text-gray-400">
                  {m.type}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words text-sm">
                {m.body ?? `[${m.type}]`}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
                <span>
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {outbound && (
                  <span className={m.status === 'read' ? 'text-brand' : ''}>
                    {statusTick(m.status)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

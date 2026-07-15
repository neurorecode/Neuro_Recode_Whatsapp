'use client';

import { useEffect, useRef } from 'react';
import type { MessageDto } from '@nrw/shared';
import { mediaSrc } from '@/lib/api';

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

function MediaBlock({ m }: { m: MessageDto }) {
  if (!m.mediaUrl) {
    return <div className="text-xs italic text-gray-400">[{m.type} — not available]</div>;
  }
  const src = mediaSrc(m.mediaUrl);
  if (m.type === 'image' || m.type === 'sticker') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="max-h-64 max-w-full rounded" />;
  }
  if (m.type === 'video') {
    return <video src={src} controls className="max-h-64 max-w-full rounded" />;
  }
  if (m.type === 'audio') {
    return <audio src={src} controls className="w-56" />;
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-sm text-brand underline"
    >
      📄 {m.mediaFilename ?? 'Document'}
    </a>
  );
}

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
    <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
      {messages.map((m) => {
        const outbound = m.direction === 'outbound';
        return (
          <div key={m.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] rounded-2xl border px-3.5 py-2 shadow-sm backdrop-blur-sm ${
                outbound
                  ? 'rounded-tr-md border-white/50 bg-[#dcfce7]/80'
                  : 'rounded-tl-md border-white/60 bg-white/75'
              }`}
            >
              {MEDIA_TYPES.has(m.type) ? (
                <div className="space-y-1">
                  <MediaBlock m={m} />
                  {m.body && (
                    <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                  )}
                </div>
              ) : (
                <>
                  {m.type === 'template' && (
                    <div className="mb-1 text-xs font-medium uppercase text-gray-400">
                      template
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-sm">
                    {m.body ?? `[${m.type}]`}
                  </div>
                </>
              )}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
                <span>
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {outbound && (
                  <span
                    className={
                      m.status === 'read'
                        ? 'text-brand'
                        : m.status === 'failed'
                          ? 'text-red-500'
                          : ''
                    }
                    title={m.errorMessage ?? undefined}
                  >
                    {statusTick(m.status)}
                  </span>
                )}
              </div>
              {outbound && m.status === 'failed' && m.errorMessage && (
                <div className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">
                  Not delivered: {m.errorMessage}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

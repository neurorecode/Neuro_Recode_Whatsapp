'use client';

import { useState } from 'react';

export function Composer({
  disabled,
  windowOpen,
  onSend,
}: {
  disabled: boolean;
  windowOpen: boolean;
  onSend: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setText('');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  if (!windowOpen) {
    return (
      <div className="border-t bg-yellow-50 p-3 text-center text-sm text-yellow-800">
        The 24-hour service window has closed. You must send an approved template
        (coming in the Templates &amp; Broadcasts phase).
      </div>
    );
  }

  return (
    <div className="border-t bg-white">
      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          Failed to send: {error}
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a message"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:border-brand focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={disabled || sending || !text.trim()}
          className="rounded-full bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CannedResponseDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconPaperclip, IconReply, IconSend } from './icons';

export function Composer({
  disabled,
  windowOpen,
  onSend,
  onSendMedia,
}: {
  disabled: boolean;
  windowOpen: boolean;
  onSend: (body: string) => Promise<void>;
  onSendMedia: (file: File, caption?: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCanned, setShowCanned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cannedQuery = useQuery({
    queryKey: ['canned'],
    queryFn: () => api.get<CannedResponseDto[]>('/canned'),
    staleTime: 60000,
  });

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

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendMedia(file, text.trim() || undefined);
      setText('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send file');
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
      {showCanned && (
        <div className="max-h-40 overflow-y-auto border-b p-2">
          {(cannedQuery.data ?? []).length === 0 && (
            <p className="px-2 py-1 text-xs text-gray-400">
              No saved replies yet — add some in Settings.
            </p>
          )}
          {(cannedQuery.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setText(c.body);
                setShowCanned(false);
              }}
              className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-gray-100"
            >
              <span className="font-medium">{c.title}</span>{' '}
              <span className="text-gray-400">— {c.body.slice(0, 50)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onFileSelected}
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          title="Attach file"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <IconPaperclip width={20} height={20} />
        </button>
        <button
          type="button"
          onClick={() => setShowCanned((v) => !v)}
          title="Quick replies"
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full transition hover:bg-gray-100 ${
            showCanned ? 'text-brand' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <IconReply width={20} height={20} />
        </button>
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
          title="Send"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          <IconSend width={18} height={18} />
        </button>
      </div>
    </div>
  );
}

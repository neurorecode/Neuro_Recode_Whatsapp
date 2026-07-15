'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CannedResponseDto } from '@nrw/shared';
import { api } from '@/lib/api';
import { IconPaperclip, IconReply, IconSend, IconClose } from './icons';

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cannedQuery = useQuery({
    queryKey: ['canned'],
    queryFn: () => api.get<CannedResponseDto[]>('/canned'),
    staleTime: 60000,
  });

  // Object URL cleanup for image previews.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setPendingFile(file);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }

  function cancelMedia() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
  }

  async function confirmMedia() {
    if (!pendingFile || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendMedia(pendingFile, text.trim() || undefined);
      setText('');
      cancelMedia();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send file');
    } finally {
      setSending(false);
    }
  }

  if (!windowOpen) {
    return (
      <div className="border-t border-white/40 bg-amber-50/50 p-3 text-center text-sm text-amber-800">
        The 24-hour service window has closed — send an approved template (from Templates /
        Broadcasts) to re-engage this contact.
      </div>
    );
  }

  const errorBanner = error && (
    <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
      Failed to send: {error}
    </div>
  );

  // ---- Media preview mode ----
  if (pendingFile) {
    const kb = Math.round(pendingFile.size / 1024);
    return (
      <div className="border-t border-white/40 bg-white/30">
        {errorBanner}
        <div className="p-3">
          <div className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/50 p-3 backdrop-blur">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-20 w-20 flex-none rounded-lg object-cover" />
            ) : (
              <div className="flex h-20 w-20 flex-none items-center justify-center rounded-lg bg-white text-3xl">
                📄
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-800">{pendingFile.name}</div>
              <div className="text-xs text-gray-400">
                {kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}
              </div>
            </div>
            <button
              onClick={cancelMedia}
              disabled={sending}
              title="Remove"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <IconClose />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  confirmMedia();
                }
              }}
              placeholder="Add a caption (optional)"
              className="glass-input flex-1 rounded-full px-4 py-2"
            />
            <button
              onClick={cancelMedia}
              disabled={sending}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={confirmMedia}
              disabled={sending}
              className="flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              <IconSend width={16} height={16} />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Normal text mode ----
  return (
    <div className="border-t border-white/40 bg-white/30">
      {errorBanner}
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
          className="glass-input flex-1 rounded-full px-4 py-2"
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

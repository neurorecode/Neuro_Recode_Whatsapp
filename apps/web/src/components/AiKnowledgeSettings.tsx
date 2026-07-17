'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type AiSetting = { knowledgeBase: string; tone: string };

export function AiKnowledgeSettings({ isAdmin }: { isAdmin: boolean }) {
  const statusQuery = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<{ configured: boolean }>('/ai/status') });
  const settingQuery = useQuery({ queryKey: ['ai-settings'], queryFn: () => api.get<AiSetting>('/ai/settings') });

  const [kb, setKb] = useState('');
  const [tone, setTone] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (settingQuery.data) {
      setKb(settingQuery.data.knowledgeBase ?? '');
      setTone(settingQuery.data.tone ?? '');
    }
  }, [settingQuery.data]);

  async function save() {
    setBusy(true);
    setSaved('');
    try {
      await api.put('/ai/settings', { knowledgeBase: kb, tone });
      setSaved('Saved');
      setTimeout(() => setSaved(''), 2000);
    } finally {
      setBusy(false);
    }
  }

  const configured = statusQuery.data?.configured;

  return (
    <section className="glass-card col-span-full rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI assist</h2>
        {saved && <span className="text-sm text-green-600">{saved}</span>}
      </div>

      {statusQuery.data && !configured && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          AI is not yet enabled. Add <code>ANTHROPIC_API_KEY</code> to the server <code>.env</code> and rebuild the API to turn on AI-drafted replies and summaries.
        </p>
      )}

      <p className="mb-3 text-sm text-gray-500">
        The AI drafts replies (agents review before sending) and summarizes conversations, grounded in the knowledge below.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Reply tone</label>
          <input
            disabled={!isAdmin}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Warm, supportive, and professional."
            className="w-full glass-input rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Knowledge base / FAQs</label>
          <textarea
            disabled={!isAdmin}
            rows={8}
            value={kb}
            onChange={(e) => setKb(e.target.value)}
            placeholder={
              'Paste business facts and FAQs the AI should use, e.g.\n\nQ: What programs do you offer?\nA: …\n\nBooking link: https://calendly.com/neurorecode/…\nRefund policy: …'
            }
            className="w-full glass-input rounded-xl px-3 py-2 text-sm"
          />
        </div>
        {isAdmin && (
          <button
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save AI knowledge'}
          </button>
        )}
      </div>
    </section>
  );
}

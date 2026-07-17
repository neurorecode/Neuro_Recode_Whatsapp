'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { IconSparkle, IconClose, IconSend, IconSettings } from './icons';

type Msg = { role: 'user' | 'assistant'; content: string };
type AiSetting = { knowledgeBase: string; tone: string };

const GREETING: Msg = {
  role: 'assistant',
  content: "Hi! I'm your AI assistant. Ask me to draft a reply, summarize a chat, translate, or answer a customer question from your knowledge base.",
};

export function AiAssistant() {
  const token = useAuth((s) => s.token);
  const agent = useAuth((s) => s.agent);
  const isAdmin = agent?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Settings state
  const [kb, setKb] = useState('');
  const [tone, setTone] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!open || configured !== null) return;
    api.get<{ configured: boolean }>('/ai/status').then((r) => setConfigured(r.configured)).catch(() => setConfigured(false));
    api.get<AiSetting>('/ai/settings').then((s) => { setKb(s.knowledgeBase ?? ''); setTone(s.tone ?? ''); }).catch(() => {});
  }, [open, configured]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  if (!token) return null;

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...msgs, { role: 'user' as const, content }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const res = await api.post<{ reply: string }>('/ai/chat', {
        messages: next.filter((m) => m !== GREETING).map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs((p) => [...p, { role: 'assistant', content: res.reply }]);
    } catch (e: any) {
      setMsgs((p) => [...p, { role: 'assistant', content: e?.message ?? 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    await api.put('/ai/settings', { knowledgeBase: kb, tone });
    setSavedMsg('Saved');
    setConfigured(null); // re-check status
    setTimeout(() => setSavedMsg(''), 1800);
  }

  return (
    <>
      {/* Launcher bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="AI assistant"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/40 transition hover:scale-105"
        >
          <IconSparkle width={24} height={24} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="glass-card fixed bottom-5 right-5 z-40 flex h-[560px] max-h-[85vh] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl">
          <header className="flex flex-none items-center justify-between border-b border-white/40 bg-gradient-to-r from-brand/90 to-brand-dark/90 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <IconSparkle width={18} height={18} />
              <span className="font-semibold">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button
                  onClick={() => setView((v) => (v === 'chat' ? 'settings' : 'chat'))}
                  title={view === 'chat' ? 'Knowledge base' : 'Back to chat'}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20"
                >
                  <IconSettings width={16} height={16} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20">
                <IconClose width={16} height={16} />
              </button>
            </div>
          </header>

          {view === 'settings' ? (
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Knowledge base</h3>
                {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Reply tone</label>
                <input value={tone} onChange={(e) => setTone(e.target.value)} className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Facts & FAQs</label>
                <textarea rows={12} value={kb} onChange={(e) => setKb(e.target.value)} placeholder="Programs, pricing, booking link, refund policy…" className="w-full glass-input rounded-xl px-3 py-2 text-sm" />
              </div>
              <button onClick={saveSettings} className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2 text-sm font-medium text-white shadow-md shadow-brand/30 hover:shadow-brand/40">
                Save
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {configured === false && (
                  <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                    AI isn’t enabled yet. Add <code>ANTHROPIC_API_KEY</code> to the server <code>.env</code> and rebuild the API.
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                        m.role === 'user'
                          ? 'rounded-tr-sm bg-brand text-white'
                          : 'rounded-tl-sm bg-white/70 text-gray-800'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-tl-sm bg-white/70 px-3 py-2 text-sm text-gray-400">Thinking…</div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="flex flex-none items-center gap-2 border-t border-white/40 p-3">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask the assistant…"
                  className="glass-input flex-1 rounded-full px-4 py-2 text-sm"
                />
                <button
                  onClick={send}
                  disabled={busy || !text.trim()}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  <IconSend width={18} height={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { GlassSelect } from './GlassSelect';

type DayHours = { day: number; enabled: boolean; open: string; close: string };
type Config = {
  timezone: string;
  businessHours: DayHours[] | null;
  greetingEnabled: boolean;
  greetingText: string | null;
  awayEnabled: boolean;
  awayText: string | null;
  autoReplyCooldownMin: number;
};
type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  matchType: string;
  keywords: string[];
  replyText: string;
  priority: number;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultHours(): DayHours[] {
  return DAYS.map((_, day) => ({
    day,
    enabled: day >= 1 && day <= 5,
    open: '09:00',
    close: '18:00',
  }));
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ${
        on ? 'bg-brand' : 'bg-gray-300'
      } disabled:opacity-50`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function AutomationSettings({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ['automation-config'], queryFn: () => api.get<Config>('/automation/config') });
  const rulesQuery = useQuery({ queryKey: ['automation-rules'], queryFn: () => api.get<Rule[]>('/automation/rules') });

  const [cfg, setCfg] = useState<Config | null>(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (configQuery.data && !cfg) {
      setCfg({
        ...configQuery.data,
        businessHours:
          configQuery.data.businessHours && configQuery.data.businessHours.length === 7
            ? configQuery.data.businessHours
            : defaultHours(),
        timezone: configQuery.data.timezone || 'Asia/Kolkata',
      });
    }
  }, [configQuery.data, cfg]);

  async function saveConfig() {
    if (!cfg) return;
    setBusy(true);
    setSavedMsg('');
    try {
      await api.put('/automation/config', cfg);
      queryClient.invalidateQueries({ queryKey: ['automation-config'] });
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(''), 2000);
    } finally {
      setBusy(false);
    }
  }

  // --- Rules ---
  const [rule, setRule] = useState({ name: '', keywords: '', matchType: 'contains', replyText: '', priority: 0 });

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    const keywords = rule.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (!rule.name.trim() || !rule.replyText.trim() || keywords.length === 0) return;
    await api.post('/automation/rules', { ...rule, keywords });
    setRule({ name: '', keywords: '', matchType: 'contains', replyText: '', priority: 0 });
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
  }

  async function toggleRule(r: Rule) {
    await api.patch(`/automation/rules/${r.id}`, { enabled: !r.enabled });
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
  }

  async function deleteRule(id: string) {
    await api.del(`/automation/rules/${id}`);
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
  }

  if (!cfg) return null;
  const rules = rulesQuery.data ?? [];

  return (
    <section className="glass-card col-span-full rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Automation</h2>
        {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
      </div>

      {!isAdmin && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          Only admins can change automation settings.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Greeting + away */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/50 bg-white/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">First-contact greeting</span>
              <Toggle on={cfg.greetingEnabled} disabled={!isAdmin} onChange={(v) => setCfg({ ...cfg, greetingEnabled: v })} />
            </div>
            <textarea
              rows={2}
              disabled={!isAdmin}
              value={cfg.greetingText ?? ''}
              onChange={(e) => setCfg({ ...cfg, greetingText: e.target.value })}
              placeholder="Hi! Thanks for reaching Neuro Recode 👋 How can we help?"
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border border-white/50 bg-white/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Away message (outside hours)</span>
              <Toggle on={cfg.awayEnabled} disabled={!isAdmin} onChange={(v) => setCfg({ ...cfg, awayEnabled: v })} />
            </div>
            <textarea
              rows={2}
              disabled={!isAdmin}
              value={cfg.awayText ?? ''}
              onChange={(e) => setCfg({ ...cfg, awayText: e.target.value })}
              placeholder="We're away right now — we'll reply during business hours."
              className="w-full glass-input rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Timezone</label>
            <input
              disabled={!isAdmin}
              value={cfg.timezone}
              onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })}
              className="glass-input flex-1 rounded-xl px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Auto-reply cooldown</label>
            <input
              type="number"
              min={0}
              disabled={!isAdmin}
              value={cfg.autoReplyCooldownMin}
              onChange={(e) => setCfg({ ...cfg, autoReplyCooldownMin: Number(e.target.value) })}
              className="glass-input w-20 rounded-xl px-3 py-1.5 text-sm"
            />
            <span className="text-sm text-gray-400">min</span>
          </div>
        </div>

        {/* Business hours */}
        <div className="rounded-xl border border-white/50 bg-white/40 p-3">
          <div className="mb-2 text-sm font-medium">Business hours</div>
          <div className="space-y-1.5">
            {cfg.businessHours!.map((h, i) => (
              <div key={h.day} className="flex items-center gap-2 text-sm">
                <span className="w-10 text-gray-500">{DAYS[h.day]}</span>
                <Toggle
                  on={h.enabled}
                  disabled={!isAdmin}
                  onChange={(v) =>
                    setCfg({
                      ...cfg,
                      businessHours: cfg.businessHours!.map((x, xi) => (xi === i ? { ...x, enabled: v } : x)),
                    })
                  }
                />
                <input
                  type="time"
                  disabled={!isAdmin || !h.enabled}
                  value={h.open}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      businessHours: cfg.businessHours!.map((x, xi) => (xi === i ? { ...x, open: e.target.value } : x)),
                    })
                  }
                  className="glass-input rounded-lg px-2 py-1 text-xs disabled:opacity-50"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  disabled={!isAdmin || !h.enabled}
                  value={h.close}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      businessHours: cfg.businessHours!.map((x, xi) => (xi === i ? { ...x, close: e.target.value } : x)),
                    })
                  }
                  className="glass-input rounded-lg px-2 py-1 text-xs disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={saveConfig}
          disabled={busy}
          className="mt-4 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-5 py-2 text-sm font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save automation settings'}
        </button>
      )}

      {/* Keyword rules */}
      <div className="mt-6 border-t border-white/40 pt-4">
        <h3 className="mb-3 text-sm font-semibold">Keyword auto-responses</h3>
        <div className="mb-3 space-y-1.5">
          {rules.length === 0 && <p className="text-xs text-gray-400">No keyword rules yet.</p>}
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-xl border border-white/50 bg-white/40 px-3 py-2 text-sm">
              <Toggle on={r.enabled} disabled={!isAdmin} onChange={() => toggleRule(r)} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {r.name} <span className="text-xs text-gray-400">· {r.matchType} · {r.keywords.join(', ')}</span>
                </div>
                <div className="truncate text-xs text-gray-500">{r.replyText}</div>
              </div>
              {isAdmin && (
                <button onClick={() => deleteRule(r.id)} className="text-xs text-gray-400 hover:text-red-500">
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <form onSubmit={addRule} className="grid gap-2 md:grid-cols-2">
            <input
              placeholder="Rule name (e.g. Pricing)"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              className="glass-input rounded-xl px-3 py-2 text-sm"
            />
            <input
              placeholder="Keywords, comma-separated (price, cost)"
              value={rule.keywords}
              onChange={(e) => setRule({ ...rule, keywords: e.target.value })}
              className="glass-input rounded-xl px-3 py-2 text-sm"
            />
            <GlassSelect
              value={rule.matchType}
              onChange={(v) => setRule({ ...rule, matchType: v })}
              options={[
                { value: 'contains', label: 'Contains keyword' },
                { value: 'exact', label: 'Exact match' },
                { value: 'starts_with', label: 'Starts with' },
              ]}
              className="w-full"
            />
            <input
              type="number"
              placeholder="Priority (higher wins)"
              value={rule.priority}
              onChange={(e) => setRule({ ...rule, priority: Number(e.target.value) })}
              className="glass-input rounded-xl px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Auto-reply text"
              rows={2}
              value={rule.replyText}
              onChange={(e) => setRule({ ...rule, replyText: e.target.value })}
              className="glass-input rounded-xl px-3 py-2 text-sm md:col-span-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand/30 transition hover:shadow-brand/40 md:col-span-2"
            >
              Add keyword rule
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

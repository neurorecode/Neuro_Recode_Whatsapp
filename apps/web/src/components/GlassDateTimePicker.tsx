'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

interface Parsed {
  y: number;
  mo: number; // 0-indexed
  d: number;
  h: number;
  mi: number;
}

function parse(value: string): Parsed | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] };
}

function format(p: Parsed): string {
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** App-themed date + time picker replacing the browser's native datetime-local. */
export function GlassDateTimePicker({
  value,
  onChange,
  placeholder = 'Pick date & time',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const parsed = parse(value);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [view, setView] = useState(() =>
    parsed ? { y: parsed.y, mo: parsed.mo } : { y: now.getFullYear(), mo: now.getMonth() },
  );

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => btnRef.current && setRect(btnRef.current.getBoundingClientRect());
    place();
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const hour = parsed?.h ?? 9;
  const minute = parsed?.mi ?? 0;

  function pickDay(d: number) {
    onChange(format({ y: view.y, mo: view.mo, d, h: hour, mi: minute }));
  }
  function setTime(h: number, mi: number) {
    const d = parsed?.d ?? now.getDate();
    const y = parsed?.y ?? view.y;
    const mo = parsed?.mo ?? view.mo;
    onChange(format({ y, mo, d, h, mi }));
  }
  function prevMonth() {
    setView((v) => (v.mo === 0 ? { y: v.y - 1, mo: 11 } : { y: v.y, mo: v.mo - 1 }));
  }
  function nextMonth() {
    setView((v) => (v.mo === 11 ? { y: v.y + 1, mo: 0 } : { y: v.y, mo: v.mo + 1 }));
  }

  // Build the day grid.
  const firstWeekday = new Date(view.y, view.mo, 1).getDay();
  const daysInMonth = new Date(view.y, view.mo + 1, 0).getDate();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const label = parsed
    ? new Date(parsed.y, parsed.mo, parsed.d, parsed.h, parsed.mi).toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  let panelStyle: React.CSSProperties = {};
  if (rect) {
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const openUp = spaceBelow < 420 && rect.top > spaceBelow;
    panelStyle = {
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 320),
      width: 300,
      zIndex: 60,
      ...(openUp ? { bottom: vh - rect.top + 8 } : { top: rect.bottom + 8 }),
    };
  }

  return (
    <div className={className}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="soft-control flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-gray-400">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={`flex-1 text-left ${label ? '' : 'text-gray-400'}`}>{label || placeholder}</span>
      </button>

      {mounted &&
        open &&
        rect &&
        createPortal(
          <div ref={panelRef} style={panelStyle} className="glass-card dropdown-pop rounded-2xl p-3 shadow-2xl shadow-purple-900/20">
            {/* Month header */}
            <div className="mb-2 flex items-center justify-between px-1">
              <button type="button" onClick={prevMonth} className="rounded-lg p-1 text-gray-500 hover:bg-white/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span className="text-sm font-semibold text-gray-700">
                {MONTHS[view.mo]} {view.y}
              </span>
              <button type="button" onClick={nextMonth} className="rounded-lg p-1 text-gray-500 hover:bg-white/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>

            {/* Weekday row */}
            <div className="grid grid-cols-7 gap-1 px-1 text-center text-[11px] font-medium text-gray-400">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>

            {/* Days */}
            <div className="mt-1 grid grid-cols-7 gap-1 px-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const cellTime = new Date(view.y, view.mo, d).getTime();
                const isPast = cellTime < todayMidnight;
                const isSelected = parsed && parsed.y === view.y && parsed.mo === view.mo && parsed.d === d;
                const isToday = cellTime === todayMidnight;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isPast}
                    onClick={() => pickDay(d)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition ${
                      isSelected
                        ? 'bg-brand font-semibold text-white'
                        : isPast
                          ? 'text-gray-300'
                          : isToday
                            ? 'font-semibold text-brand-dark ring-1 ring-brand/40 hover:bg-white/60'
                            : 'text-gray-700 hover:bg-white/60'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Time */}
            <div className="mt-3 flex items-center gap-2 border-t border-white/40 px-1 pt-3">
              <span className="text-xs font-medium text-gray-500">Time</span>
              <input
                type="number"
                min={0}
                max={23}
                value={pad(hour)}
                onChange={(e) => setTime(Math.max(0, Math.min(23, Number(e.target.value))), minute)}
                className="glass-input w-14 rounded-lg px-2 py-1 text-center text-sm"
              />
              <span className="text-gray-400">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={pad(minute)}
                onChange={(e) => setTime(hour, Math.max(0, Math.min(59, Number(e.target.value))))}
                className="glass-input w-14 rounded-lg px-2 py-1 text-center text-sm"
              />
              <div className="ml-auto flex gap-2">
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                    }}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

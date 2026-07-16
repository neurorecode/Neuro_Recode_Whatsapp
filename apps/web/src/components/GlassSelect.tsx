'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type GlassOption = {
  value: string;
  label: string;
  hint?: string;
  /** Optional colored dot (tailwind bg-* class) shown before the label. */
  dotClass?: string;
};

/**
 * App-styled dropdown replacing the native <select>. Renders its option panel in
 * a portal with fixed positioning so it's never clipped by a card/modal's
 * overflow, and matches the glassmorphism theme.
 */
export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  disabled = false,
  leading,
}: {
  value: string;
  onChange: (v: string) => void;
  options: GlassOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  leading?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => btnRef.current && setRect(btnRef.current.getBoundingClientRect());
    place();
    const onScroll = (e: Event) => {
      // Scrolling inside the options panel itself must NOT close it.
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

  // Position the portal panel above or below the trigger depending on space.
  let panelStyle: React.CSSProperties = {};
  let openUp = false;
  if (rect) {
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    openUp = spaceBelow < 260 && rect.top > spaceBelow;
    panelStyle = {
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 60,
      ...(openUp
        ? { bottom: vh - rect.top + 8, maxHeight: rect.top - 16 }
        : { top: rect.bottom + 8, maxHeight: spaceBelow - 16 }),
    };
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="soft-control flex w-full items-center gap-2 rounded-full py-2 pl-3.5 pr-3 text-sm font-medium text-gray-700 disabled:opacity-50"
      >
        {leading}
        {selected?.dotClass && (
          <span className={`h-2 w-2 flex-none rounded-full ${selected.dotClass}`} />
        )}
        <span className={`flex-1 truncate text-left ${selected ? '' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-none text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {mounted &&
        open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className={`glass-card overflow-y-auto rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20 ${
              openUp ? 'origin-bottom' : 'origin-top'
            } dropdown-pop`}
          >
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No options</div>
            )}
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'bg-brand/15 font-semibold text-brand-dark'
                      : 'text-gray-700 hover:bg-white/70'
                  }`}
                >
                  {o.dotClass && <span className={`h-2 w-2 flex-none rounded-full ${o.dotClass}`} />}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="flex-none text-xs text-gray-400">{o.hint}</span>}
                  {active && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-none text-brand"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

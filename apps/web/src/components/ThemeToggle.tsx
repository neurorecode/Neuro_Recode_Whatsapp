'use client';

import { useEffect, useState } from 'react';
import { IconSun, IconMoon } from './icons';

type Theme = 'light' | 'dark';

/** Toggles the app between light and dark, persisting the choice in localStorage. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('nrw-theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
      className={`relative inline-flex h-8 w-14 flex-none items-center rounded-full border border-white/50 bg-white/50 px-1 transition ${className}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow transition-transform duration-300 ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <IconMoon width={14} height={14} /> : <IconSun width={14} height={14} />}
      </span>
    </button>
  );
}

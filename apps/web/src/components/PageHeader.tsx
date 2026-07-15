'use client';

import { useAuth } from '@/lib/auth';
import { IconChevron } from './icons';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const agent = useAuth((s) => s.agent);

  return (
    <header className="flex items-center justify-between gap-4 px-8 pb-4 pt-6">
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-2 rounded-full bg-white/60 px-2 py-1.5 pr-3 shadow-sm ring-1 ring-white/60 backdrop-blur">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-semibold text-white">
            {(agent?.name ?? 'NR').slice(0, 2).toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium text-gray-800 sm:block">{agent?.name}</span>
          <IconChevron width={16} height={16} className="text-gray-400" />
        </div>
      </div>
    </header>
  );
}

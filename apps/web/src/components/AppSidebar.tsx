'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { disconnectSocket } from '@/lib/socket';
import {
  IconInbox,
  IconTemplate,
  IconMegaphone,
  IconSettings,
  IconLogout,
  IconFlow,
  IconBolt,
} from './icons';
import { ThemeToggle } from './ThemeToggle';

type Item = { href: string; label: string; icon: (p: any) => JSX.Element };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Main Menu',
    items: [{ href: '/inbox', label: 'Inbox', icon: IconInbox }],
  },
  {
    title: 'Messaging',
    items: [
      { href: '/templates', label: 'Templates', icon: IconTemplate },
      { href: '/broadcasts', label: 'Broadcasts', icon: IconMegaphone },
      { href: '/sequences', label: 'Sequences', icon: IconFlow },
      { href: '/automation', label: 'Automation', icon: IconBolt },
    ],
  },
  {
    title: 'Workspace',
    items: [{ href: '/settings', label: 'Settings', icon: IconSettings }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { agent, logout } = useAuth();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="glass z-20 flex w-60 flex-none flex-col border-r border-white/40 px-4 py-5">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white shadow-md">
          N
        </div>
        <span className="text-[15px] font-bold tracking-tight text-gray-900">Neuro Recode</span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {g.title}
            </div>
            <div className="space-y-1">
              {g.items.map((it) => {
                const active = isActive(it.href);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? 'bg-white/70 font-semibold text-brand-dark shadow-sm ring-1 ring-white/60'
                        : 'text-gray-500 hover:bg-white/40 hover:text-gray-800'
                    }`}
                  >
                    <Icon width={18} height={18} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2 ring-1 ring-white/50">
        <span className="text-xs font-medium text-gray-500">Appearance</span>
        <ThemeToggle />
      </div>

      {/* Profile */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/50 p-2 ring-1 ring-white/50">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-semibold text-white">
          {(agent?.name ?? 'NR').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-800">{agent?.name}</div>
          <div className="truncate text-[11px] capitalize text-gray-400">{agent?.role}</div>
        </div>
        <button
          onClick={() => {
            disconnectSocket();
            logout();
            router.replace('/login');
          }}
          title="Log out"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/70 hover:text-red-500"
        >
          <IconLogout width={16} height={16} />
        </button>
      </div>
    </aside>
  );
}

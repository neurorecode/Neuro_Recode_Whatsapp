'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { disconnectSocket } from '@/lib/socket';

const LINKS = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/templates', label: 'Templates' },
  { href: '/broadcasts', label: 'Broadcasts' },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { agent, logout } = useAuth();

  return (
    <header className="flex items-center justify-between bg-brand-dark px-4 py-2 text-white">
      <div className="flex items-center gap-1">
        <span className="mr-3 font-semibold">Neuro Recode</span>
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded px-3 py-1 text-sm ${
                active ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-80">{agent?.name}</span>
        <button
          onClick={() => {
            disconnectSocket();
            logout();
            router.replace('/login');
          }}
          className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

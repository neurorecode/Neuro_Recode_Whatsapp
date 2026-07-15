'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const { token, hydrated } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(token ? '/inbox' : '/login');
  }, [token, hydrated, router]);

  return (
    <main className="flex h-screen items-center justify-center text-gray-500">Loading…</main>
  );
}

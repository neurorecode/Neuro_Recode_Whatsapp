'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth';

/** Redirects to /login once hydration confirms there is no token. */
export function useRequireAuth() {
  const router = useRouter();
  const { token, agent, hydrated } = useAuth();

  useEffect(() => {
    if (hydrated && !token) router.replace('/login');
  }, [hydrated, token, router]);

  return { token, agent, ready: hydrated && !!token };
}

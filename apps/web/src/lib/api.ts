'use client';

import { API_BASE } from './config';
import { useAuth } from './auth';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token;
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    useAuth.getState().logout();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Build an authenticated media URL usable in <img>/<audio>/<video>/<a>. */
export function mediaSrc(mediaUrl: string): string {
  const token = useAuth.getState().token;
  return `${API_BASE}${mediaUrl}${token ? `?t=${encodeURIComponent(token)}` : ''}`;
}

/** Upload a file as a media message (multipart). */
export async function uploadMedia(conversationId: string, file: File, caption?: string) {
  const token = useAuth.getState().token;
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  const res = await fetch(
    `${API_BASE}/api/conversations/${conversationId}/messages/media`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Upload failed');
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Login failed');
  }
  return res.json();
}

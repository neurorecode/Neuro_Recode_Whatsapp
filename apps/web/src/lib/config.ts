export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? API_BASE;

'use client';

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { SOCKET_NAMESPACE, ServerToClientEvents, ClientToServerEvents } from '@nrw/shared';

export type AgentSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AgentSocket | null = null;

export function getSocket(token: string): AgentSocket {
  if (socket) return socket;
  socket = io(`${SOCKET_URL}${SOCKET_NAMESPACE}`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

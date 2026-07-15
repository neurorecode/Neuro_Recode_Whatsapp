'use client';

import { create } from 'zustand';
import type { AgentDto } from '@nrw/shared';

interface AuthState {
  token: string | null;
  agent: AgentDto | null;
  hydrated: boolean;
  setAuth: (token: string, agent: AgentDto) => void;
  logout: () => void;
  hydrate: () => void;
}

const TOKEN_KEY = 'nrw.token';
const AGENT_KEY = 'nrw.agent';

export const useAuth = create<AuthState>((set) => ({
  token: null,
  agent: null,
  hydrated: false,
  setAuth: (token, agent) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
    }
    set({ token, agent });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(AGENT_KEY);
    }
    set({ token: null, agent: null });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(TOKEN_KEY);
    const agentRaw = localStorage.getItem(AGENT_KEY);
    set({
      token,
      agent: agentRaw ? (JSON.parse(agentRaw) as AgentDto) : null,
      hydrated: true,
    });
  },
}));

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationListItem, MessageDto } from '@nrw/shared';
import { useAuth } from '@/lib/auth';
import { api, uploadMedia } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { ConversationList } from '@/components/ConversationList';
import { MessageThread } from '@/components/MessageThread';
import { Composer } from '@/components/Composer';
import { ContactControls } from '@/components/ContactControls';
import { TicketControls } from '@/components/TicketControls';
import { NotesPanel } from '@/components/NotesPanel';
import { AppNav } from '@/components/AppNav';

export default function InboxPage() {
  const router = useRouter();
  const { token, hydrated } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ConversationListItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'pending' | 'closed'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  // Auth guard
  useEffect(() => {
    if (hydrated && !token) router.replace('/login');
  }, [hydrated, token, router]);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', statusFilter, mineOnly, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (mineOnly) params.set('assignee', 'me');
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      return api.get<ConversationListItem[]>(`/conversations${qs ? `?${qs}` : ''}`);
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const messagesQuery = useQuery({
    queryKey: ['messages', selected?.id],
    queryFn: () => api.get<MessageDto[]>(`/conversations/${selected!.id}/messages`),
    enabled: !!token && !!selected,
  });

  // Real-time socket wiring
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const refetchConversations = () =>
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    const refetchMessages = (conversationId: string) => {
      if (selected?.id === conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      }
    };

    socket.on('message:new', (evt) => {
      refetchConversations();
      refetchMessages(evt.conversationId);
    });
    socket.on('message:status', (evt) => refetchMessages(evt.conversationId));
    socket.on('conversation:updated', refetchConversations);

    return () => {
      socket.off('message:new');
      socket.off('message:status');
      socket.off('conversation:updated');
    };
  }, [token, selected?.id, queryClient]);

  useEffect(() => () => disconnectSocket(), []);

  // Keep the selected conversation fresh when the list refetches (e.g. after
  // editing the contact's tags / opt-in, or a new inbound message).
  useEffect(() => {
    setSelected((cur) => {
      if (!cur) return cur;
      return (conversationsQuery.data ?? []).find((c) => c.id === cur.id) ?? cur;
    });
  }, [conversationsQuery.data]);

  async function onSelect(c: ConversationListItem) {
    setSelected(c);
    if (c.unreadCount > 0) {
      await api.post(`/conversations/${c.id}/read`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }

  async function onSend(body: string) {
    if (!selected) return;
    await api.post(`/conversations/${selected.id}/messages`, { body });
    queryClient.invalidateQueries({ queryKey: ['messages', selected.id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  async function onSendMedia(file: File, caption?: string) {
    if (!selected) return;
    await uploadMedia(selected.id, file, caption);
    queryClient.invalidateQueries({ queryKey: ['messages', selected.id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const selectedName = useMemo(() => {
    if (!selected) return '';
    return selected.contact.displayName || selected.contact.profileName || selected.contact.waId;
  }, [selected]);

  if (!hydrated) {
    return <main className="flex h-screen items-center justify-center text-gray-500">Loading…</main>;
  }

  return (
    <main className="flex h-screen flex-col">
      <AppNav />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-96 flex-none flex-col border-r bg-white">
          <div className="space-y-2 border-b bg-gray-50 px-3 py-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number…"
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
            <div className="flex items-center gap-1 text-xs">
              {(['all', 'open', 'pending', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-2 py-0.5 capitalize ${
                    statusFilter === s ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1 text-gray-600">
                <input
                  type="checkbox"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                />
                Mine
              </label>
            </div>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selected?.id ?? null}
            onSelect={onSelect}
          />
        </aside>

        {/* Thread */}
        <section className="flex flex-1 flex-col">
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b bg-white px-4 py-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {selectedName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{selectedName}</div>
                  <div className="text-xs text-gray-400">
                    {selected.contact.waId} ·{' '}
                    {selected.windowOpen ? (
                      <span className="text-green-600">window open</span>
                    ) : (
                      <span className="text-yellow-600">window closed</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <TicketControls
                    conversationId={selected.id}
                    status={selected.status}
                    assigneeAgentId={selected.assigneeAgentId}
                    onUpdated={() =>
                      queryClient.invalidateQueries({ queryKey: ['conversations'] })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <ContactControls
                      contactId={selected.contact.id}
                      tags={selected.contact.tags}
                      optInStatus={selected.contact.optInStatus}
                      onUpdated={() =>
                        queryClient.invalidateQueries({ queryKey: ['conversations'] })
                      }
                    />
                    <button
                      onClick={() => setShowNotes((v) => !v)}
                      className={`rounded px-2 py-0.5 text-xs ${
                        showNotes ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Notes
                    </button>
                  </div>
                </div>
              </header>
              <MessageThread messages={messages} />
              <Composer
                disabled={false}
                windowOpen={selected.windowOpen}
                onSend={onSend}
                onSendMedia={onSendMedia}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-[#efeae2] text-gray-400">
              Select a conversation to start
            </div>
          )}
        </section>
        {selected && showNotes && <NotesPanel conversationId={selected.id} />}
      </div>
    </main>
  );
}

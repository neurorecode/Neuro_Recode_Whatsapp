'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationListItem, MessageDto } from '@nrw/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { ConversationList } from '@/components/ConversationList';
import { MessageThread } from '@/components/MessageThread';
import { Composer } from '@/components/Composer';
import { ContactControls } from '@/components/ContactControls';
import { AppNav } from '@/components/AppNav';

export default function InboxPage() {
  const router = useRouter();
  const { token, hydrated } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ConversationListItem | null>(null);

  // Auth guard
  useEffect(() => {
    if (hydrated && !token) router.replace('/login');
  }, [hydrated, token, router]);

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<ConversationListItem[]>('/conversations'),
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
          <header className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600">
            Conversations
          </header>
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
                <ContactControls
                  contactId={selected.contact.id}
                  tags={selected.contact.tags}
                  optInStatus={selected.contact.optInStatus}
                  onUpdated={() =>
                    queryClient.invalidateQueries({ queryKey: ['conversations'] })
                  }
                />
              </header>
              <MessageThread messages={messages} />
              <Composer disabled={false} windowOpen={selected.windowOpen} onSend={onSend} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-[#efeae2] text-gray-400">
              Select a conversation to start
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

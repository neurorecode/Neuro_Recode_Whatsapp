'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationListItem, MessageDto } from '@nrw/shared';
import { useAuth } from '@/lib/auth';
import { api, uploadMedia } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { ConversationList } from '@/components/ConversationList';
import { MessageThread } from '@/components/MessageThread';
import { Composer } from '@/components/Composer';
import { ConversationHeader } from '@/components/ConversationHeader';
import { ContactPanel } from '@/components/ContactPanel';
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
  const [panel, setPanel] = useState<'info' | 'notes' | null>(null);

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
              <ConversationHeader
                conversation={selected}
                onUpdated={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}
                infoOpen={panel === 'info'}
                notesOpen={panel === 'notes'}
                onToggleInfo={() => setPanel((p) => (p === 'info' ? null : 'info'))}
                onToggleNotes={() => setPanel((p) => (p === 'notes' ? null : 'notes'))}
              />
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
        {selected && panel === 'info' && (
          <ContactPanel
            contact={selected.contact}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}
            onClose={() => setPanel(null)}
          />
        )}
        {selected && panel === 'notes' && (
          <NotesPanel conversationId={selected.id} onClose={() => setPanel(null)} />
        )}
      </div>
    </main>
  );
}

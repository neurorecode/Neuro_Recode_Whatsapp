'use client';

import type { ConversationListItem } from '@nrw/shared';

function initials(name: string | null, waId: string) {
  const base = name?.trim() || waId;
  return base.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (c: ConversationListItem) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {conversations.length === 0 && (
        <div className="p-6 text-center text-sm text-gray-400">
          No conversations yet. Message your WhatsApp number to see it here.
        </div>
      )}
      {conversations.map((c) => {
        const name = c.contact.displayName || c.contact.profileName || c.contact.waId;
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`flex items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
              active ? 'bg-gray-100' : ''
            }`}
          >
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
              {initials(c.contact.displayName || c.contact.profileName, c.contact.waId)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate font-medium">{name}</span>
                <span className="ml-2 flex-none text-xs text-gray-400">
                  {timeAgo(c.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm text-gray-500">
                  {c.lastMessageText ?? ''}
                </span>
                {c.unreadCount > 0 && (
                  <span className="ml-2 flex-none rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

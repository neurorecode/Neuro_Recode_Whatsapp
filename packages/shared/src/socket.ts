// Real-time contract between the API (Socket.IO gateway) and the web client.

export const SOCKET_NAMESPACE = '/agent';

/** Events the server emits to connected agents. */
export interface ServerToClientEvents {
  'message:new': (payload: MessageEvent) => void;
  'message:status': (payload: MessageStatusEvent) => void;
  'conversation:updated': (payload: ConversationEvent) => void;
  'presence:update': (payload: { agentId: string; presence: string }) => void;
}

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  'conversation:subscribe': (conversationId: string) => void;
  'conversation:unsubscribe': (conversationId: string) => void;
  'agent:typing': (payload: { conversationId: string; typing: boolean }) => void;
}

export interface MessageEvent {
  conversationId: string;
  message: {
    id: string;
    wamid: string | null;
    direction: 'inbound' | 'outbound';
    type: string;
    body: string | null;
    mediaUrl?: string | null;
    status: string;
    senderAgentId?: string | null;
    timestamp: string;
  };
  contact: {
    id: string;
    waId: string;
    displayName: string | null;
    profileName: string | null;
  };
}

export interface MessageStatusEvent {
  conversationId: string;
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errorMessage?: string | null;
}

export interface ConversationEvent {
  id: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  assigneeAgentId: string | null;
}

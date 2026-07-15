// HTTP DTOs shared between web and api.

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AgentDto {
  id: string;
  name: string;
  email: string;
  role: 'agent' | 'admin';
  presence: string;
}

export interface LoginResponse {
  accessToken: string;
  agent: AgentDto;
}

export interface ContactDto {
  id: string;
  waId: string;
  displayName: string | null;
  profileName: string | null;
  phone: string | null;
}

export interface ConversationListItem {
  id: string;
  status: 'open' | 'pending' | 'closed';
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  assigneeAgentId: string | null;
  contact: ContactDto;
  windowOpen: boolean;
}

export interface MessageDto {
  id: string;
  wamid: string | null;
  direction: 'inbound' | 'outbound';
  type: string;
  body: string | null;
  mediaUrl: string | null;
  status: string;
  senderAgentId: string | null;
  timestamp: string;
}

export interface SendMessageRequest {
  body: string;
}

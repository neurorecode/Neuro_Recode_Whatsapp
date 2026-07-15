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
  tags: string[];
  optInStatus: string;
}

export interface ConversationListItem {
  id: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  assigneeAgentId: string | null;
  contact: ContactDto;
  windowOpen: boolean;
}

export interface InternalNoteDto {
  id: string;
  body: string;
  agentName: string;
  createdAt: string;
}

export interface CannedResponseDto {
  id: string;
  title: string;
  body: string;
}

export interface UpdateTicketRequest {
  assigneeAgentId?: string | null;
  status?: 'open' | 'pending' | 'closed';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface MessageDto {
  id: string;
  wamid: string | null;
  direction: 'inbound' | 'outbound';
  type: string;
  body: string | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  status: string;
  errorMessage: string | null;
  senderAgentId: string | null;
  timestamp: string;
}

export interface SendMessageRequest {
  body: string;
}

// ---- Phase 4: templates & broadcasts ----

export interface TemplateDto {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string | null;
  bodyVarCount: number;
}

export interface BroadcastCounts {
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface BroadcastListItem {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  templateName: string;
  total: number;
  counts: BroadcastCounts;
}

export interface BroadcastRecipientDto {
  id: string;
  contactName: string;
  waId: string;
  status: string;
  errorMessage: string | null;
}

export interface BroadcastDetail {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  template: { id: string; name: string; language: string };
  total: number;
  counts: BroadcastCounts;
  recipients: BroadcastRecipientDto[];
}

export interface CreateBroadcastRequest {
  name: string;
  templateId: string;
  tags: string[];
  bodyParams: string[];
}

export interface ContactManageDto {
  id: string;
  waId: string;
  displayName: string | null;
  profileName: string | null;
  tags: string[];
  optInStatus: string;
}

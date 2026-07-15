import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationListItem, MessageDto } from '@nrw/shared';
import { Prisma, ConversationStatus, Priority } from '@nrw/db';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private windowOpen(windowExpiresAt: Date | null): boolean {
    return !!windowExpiresAt && windowExpiresAt.getTime() > Date.now();
  }

  async list(filters: {
    status?: string;
    assigneeAgentId?: string;
    q?: string;
  } = {}): Promise<ConversationListItem[]> {
    const where: Prisma.ConversationWhereInput = {};
    if (filters.status) where.status = filters.status as ConversationStatus;
    if (filters.assigneeAgentId) where.assigneeAgentId = filters.assigneeAgentId;
    if (filters.q) {
      where.contact = {
        OR: [
          { waId: { contains: filters.q } },
          { displayName: { contains: filters.q, mode: 'insensitive' } },
          { profileName: { contains: filters.q, mode: 'insensitive' } },
        ],
      };
    }
    const rows = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { contact: true },
    });
    return rows.map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessageText: c.lastMessageText,
      assigneeAgentId: c.assigneeAgentId,
      contact: {
        id: c.contact.id,
        waId: c.contact.waId,
        displayName: c.contact.displayName,
        profileName: c.contact.profileName,
        phone: c.contact.phone,
        tags: c.contact.tags,
        optInStatus: c.contact.optInStatus,
      },
      windowOpen: this.windowOpen(c.contact.windowExpiresAt),
    }));
  }

  async getOrThrow(id: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!c) throw new NotFoundException('Conversation not found');
    return c;
  }

  async messages(conversationId: string): Promise<MessageDto[]> {
    await this.getOrThrow(conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      take: 200,
    });
    return rows.map((m) => ({
      id: m.id,
      wamid: m.wamid,
      direction: m.direction,
      type: m.type,
      body: m.body,
      mediaUrl: m.mediaKey ? `/api/media/${m.id}` : null,
      mediaFilename: m.mediaFilename,
      status: m.status,
      errorMessage: m.errorMessage,
      senderAgentId: m.senderAgentId,
      timestamp: m.timestamp.toISOString(),
    }));
  }

  async markRead(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  /** Update ticket fields (assignee / status / priority) and notify agents. */
  async updateTicket(
    id: string,
    data: { assigneeAgentId?: string | null; status?: string; priority?: string },
  ) {
    await this.getOrThrow(id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        assigneeAgentId: data.assigneeAgentId === undefined ? undefined : data.assigneeAgentId,
        status: data.status ? (data.status as ConversationStatus) : undefined,
        priority: data.priority ? (data.priority as Priority) : undefined,
      },
    });
    this.realtime.emitConversationUpdated({
      id: updated.id,
      status: updated.status,
      unreadCount: updated.unreadCount,
      lastMessageAt: updated.lastMessageAt?.toISOString() ?? null,
      lastMessageText: updated.lastMessageText,
      assigneeAgentId: updated.assigneeAgentId,
    });
    return updated;
  }

  async listNotes(conversationId: string) {
    await this.getOrThrow(conversationId);
    const rows = await this.prisma.internalNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { agent: { select: { name: true } } },
    });
    return rows.map((n) => ({
      id: n.id,
      body: n.body,
      agentName: n.agent.name,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async deleteNote(conversationId: string, noteId: string): Promise<void> {
    await this.prisma.internalNote.deleteMany({ where: { id: noteId, conversationId } });
  }

  async addNote(conversationId: string, agentId: string, body: string) {
    await this.getOrThrow(conversationId);
    const n = await this.prisma.internalNote.create({
      data: { conversationId, agentId, body },
      include: { agent: { select: { name: true } } },
    });
    return {
      id: n.id,
      body: n.body,
      agentName: n.agent.name,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

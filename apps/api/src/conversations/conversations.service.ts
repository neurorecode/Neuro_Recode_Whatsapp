import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationListItem, MessageDto } from '@nrw/shared';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private windowOpen(windowExpiresAt: Date | null): boolean {
    return !!windowExpiresAt && windowExpiresAt.getTime() > Date.now();
  }

  async list(status?: string): Promise<ConversationListItem[]> {
    const rows = await this.prisma.conversation.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { contact: true },
    });
    return rows.map((c) => ({
      id: c.id,
      status: c.status,
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
}

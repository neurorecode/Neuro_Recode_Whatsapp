import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageDto } from '@nrw/shared';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly realtime: RealtimeGateway,
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * Send a free-form text reply from an agent. Only allowed inside the 24h
   * customer-service window — otherwise a pre-approved template is required
   * (template sending arrives in Phase 4).
   */
  async sendText(conversationId: string, agentId: string, body: string): Promise<MessageDto> {
    const conversation = await this.conversations.getOrThrow(conversationId);
    const windowOpen =
      !!conversation.contact.windowExpiresAt &&
      conversation.contact.windowExpiresAt.getTime() > Date.now();
    if (!windowOpen) {
      throw new BadRequestException(
        'The 24-hour service window has closed. Send an approved template instead.',
      );
    }

    // Create the message optimistically as "queued".
    const pending = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'outbound',
        type: 'text',
        body,
        status: 'queued',
        senderAgentId: agentId,
      },
    });

    try {
      const { wamid } = await this.whatsapp.sendText(conversation.contact.waId, body);
      const sent = await this.prisma.message.update({
        where: { id: pending.id },
        data: { wamid, status: 'sent' },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: sent.timestamp, lastMessageText: body },
      });

      const dto = this.toDto(sent);
      this.realtime.emitNewMessage({
        conversationId,
        message: {
          id: sent.id,
          wamid: sent.wamid,
          direction: 'outbound',
          type: 'text',
          body: sent.body,
          status: sent.status,
          senderAgentId: agentId,
          timestamp: sent.timestamp.toISOString(),
        },
        contact: {
          id: conversation.contact.id,
          waId: conversation.contact.waId,
          displayName: conversation.contact.displayName,
          profileName: conversation.contact.profileName,
        },
      });
      return dto;
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      await this.prisma.message.update({
        where: { id: pending.id },
        data: {
          status: 'failed',
          errorCode: apiError ? String(apiError.code) : undefined,
          errorMessage: apiError?.message ?? err?.message,
        },
      });
      throw new BadRequestException(apiError?.message ?? 'Failed to send message');
    }
  }

  private toDto(m: {
    id: string;
    wamid: string | null;
    direction: string;
    type: string;
    body: string | null;
    status: string;
    senderAgentId: string | null;
    timestamp: Date;
  }): MessageDto {
    return {
      id: m.id,
      wamid: m.wamid,
      direction: m.direction as 'inbound' | 'outbound',
      type: m.type,
      body: m.body,
      mediaUrl: null,
      status: m.status,
      senderAgentId: m.senderAgentId,
      timestamp: m.timestamp.toISOString(),
    };
  }
}

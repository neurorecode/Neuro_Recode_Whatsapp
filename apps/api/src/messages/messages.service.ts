import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationsService } from '../conversations/conversations.service';
import { MediaStorageService } from '../media/media-storage.service';
import { MessageDto } from '@nrw/shared';
import { Message, MessageType } from '@nrw/db';

export interface UploadedMedia {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly realtime: RealtimeGateway,
    private readonly conversations: ConversationsService,
    private readonly storage: MediaStorageService,
  ) {}

  private assertWindowOpen(windowExpiresAt: Date | null) {
    const open = !!windowExpiresAt && windowExpiresAt.getTime() > Date.now();
    if (!open) {
      throw new BadRequestException(
        'The 24-hour service window has closed. Send an approved template instead.',
      );
    }
  }

  /** Send a free-form text reply (only inside the 24h window). */
  async sendText(conversationId: string, agentId: string, body: string): Promise<MessageDto> {
    const conversation = await this.conversations.getOrThrow(conversationId);
    this.assertWindowOpen(conversation.contact.windowExpiresAt);

    const pending = await this.prisma.message.create({
      data: { conversationId, direction: 'outbound', type: 'text', body, status: 'queued', senderAgentId: agentId },
    });

    try {
      const { wamid } = await this.whatsapp.sendText(conversation.contact.waId, body);
      const sent = await this.prisma.message.update({
        where: { id: pending.id },
        data: { wamid, status: 'sent' },
      });
      await this.finishOutbound(conversation, sent, body);
      return this.toDto(sent);
    } catch (err: any) {
      await this.markFailed(pending.id, err);
      throw new BadRequestException(err?.response?.data?.error?.message ?? 'Failed to send message');
    }
  }

  /** Upload a file to WhatsApp, store it, and send it as a media message. */
  async sendMedia(
    conversationId: string,
    agentId: string,
    file: UploadedMedia,
    caption?: string,
  ): Promise<MessageDto> {
    const conversation = await this.conversations.getOrThrow(conversationId);
    this.assertWindowOpen(conversation.contact.windowExpiresAt);

    const type = this.mediaTypeFromMime(file.mimetype);
    const key = `outbound/${randomUUID()}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    const pending = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'outbound',
        type,
        body: caption || null,
        mediaKey: key,
        mediaMime: file.mimetype,
        mediaFilename: type === 'document' ? file.originalname : null,
        status: 'queued',
        senderAgentId: agentId,
      },
    });

    try {
      const mediaId = await this.whatsapp.uploadMedia(file.buffer, file.mimetype, file.originalname);
      const { wamid } = await this.whatsapp.sendMedia(
        conversation.contact.waId,
        type as 'image' | 'video' | 'audio' | 'document',
        mediaId,
        caption,
        type === 'document' ? file.originalname : undefined,
      );
      const sent = await this.prisma.message.update({
        where: { id: pending.id },
        data: { wamid, status: 'sent' },
      });
      await this.finishOutbound(conversation, sent, caption || `[${type}]`);
      return this.toDto(sent);
    } catch (err: any) {
      await this.markFailed(pending.id, err);
      throw new BadRequestException(err?.response?.data?.error?.message ?? 'Failed to send media');
    }
  }

  private mediaTypeFromMime(mime: string): MessageType {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private async finishOutbound(
    conversation: { id: string; contact: { id: string; waId: string; displayName: string | null; profileName: string | null } },
    sent: Message,
    lastText: string,
  ) {
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: sent.timestamp, lastMessageText: lastText },
    });
    this.realtime.emitNewMessage({
      conversationId: conversation.id,
      message: {
        id: sent.id,
        wamid: sent.wamid,
        direction: 'outbound',
        type: sent.type,
        body: sent.body,
        mediaUrl: sent.mediaKey ? `/api/media/${sent.id}` : null,
        status: sent.status,
        senderAgentId: sent.senderAgentId,
        timestamp: sent.timestamp.toISOString(),
      },
      contact: {
        id: conversation.contact.id,
        waId: conversation.contact.waId,
        displayName: conversation.contact.displayName,
        profileName: conversation.contact.profileName,
      },
    });
  }

  private async markFailed(id: string, err: any) {
    const apiError = err?.response?.data?.error;
    await this.prisma.message.update({
      where: { id },
      data: {
        status: 'failed',
        errorCode: apiError ? String(apiError.code) : undefined,
        errorMessage: apiError?.message ?? err?.message,
      },
    });
  }

  private toDto(m: Message): MessageDto {
    return {
      id: m.id,
      wamid: m.wamid,
      direction: m.direction as 'inbound' | 'outbound',
      type: m.type,
      body: m.body,
      mediaUrl: m.mediaKey ? `/api/media/${m.id}` : null,
      mediaFilename: m.mediaFilename,
      status: m.status,
      senderAgentId: m.senderAgentId,
      timestamp: m.timestamp.toISOString(),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WhatsappService } from './whatsapp.service';
import { MediaStorageService } from '../media/media-storage.service';
import {
  WhatsAppWebhookBody,
  WhatsAppChangeValue,
  WhatsAppInboundMessage,
  WhatsAppEchoMessage,
  WhatsAppStatus,
  WhatsAppContact,
} from '@nrw/shared';
import { MessageType, MessageStatus, Prisma } from '@nrw/db';

const WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WhatsappIngestService {
  private readonly logger = new Logger(WhatsappIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly whatsapp: WhatsappService,
    private readonly storage: MediaStorageService,
    private readonly events: EventEmitter2,
  ) {}

  async handleWebhook(body: WhatsAppWebhookBody): Promise<void> {
    if (body.object !== 'whatsapp_business_account') return;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages' && change.field !== 'message_echoes') continue;
        const value = change.value;
        const contactsByWaId = this.indexContacts(value.contacts);
        for (const msg of value.messages ?? []) {
          await this.handleInboundMessage(msg, contactsByWaId.get(msg.from));
        }
        // Coexistence: messages the business sent from the WhatsApp Business app.
        for (const echo of value.message_echoes ?? []) {
          await this.handleEchoMessage(echo);
        }
        for (const status of value.statuses ?? []) {
          await this.handleStatus(status);
        }
      }
    }
  }

  private indexContacts(contacts?: WhatsAppContact[]): Map<string, WhatsAppContact> {
    const map = new Map<string, WhatsAppContact>();
    for (const c of contacts ?? []) map.set(c.wa_id, c);
    return map;
  }

  private async alreadyProcessed(eventKey: string): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: { eventKey, payload: {}, processedAt: new Date() },
      });
      return false;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return true; // unique violation → we've seen this event
      }
      throw e;
    }
  }

  private async handleInboundMessage(
    msg: WhatsAppInboundMessage,
    contactInfo?: WhatsAppContact,
  ): Promise<void> {
    if (await this.alreadyProcessed(`msg:${msg.id}`)) {
      this.logger.debug(`duplicate inbound ${msg.id}, skipping`);
      return;
    }

    const now = new Date();
    // Did this contact exist before this message? (drives first-contact automations)
    const priorContact = await this.prisma.contact.findUnique({
      where: { waId: msg.from },
      select: { id: true },
    });
    const contact = await this.prisma.contact.upsert({
      where: { waId: msg.from },
      create: {
        waId: msg.from,
        phone: msg.from,
        profileName: contactInfo?.profile?.name,
        displayName: contactInfo?.profile?.name,
        lastInboundAt: now,
        windowExpiresAt: new Date(now.getTime() + WINDOW_MS),
      },
      update: {
        profileName: contactInfo?.profile?.name ?? undefined,
        lastInboundAt: now,
        windowExpiresAt: new Date(now.getTime() + WINDOW_MS),
      },
    });

    // Reuse an open/pending conversation or start a new one.
    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id, status: { in: ['open', 'pending'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { contactId: contact.id, status: 'open' },
      });
    }

    const { type, body } = this.extractContent(msg);
    const timestamp = new Date(parseInt(msg.timestamp, 10) * 1000);

    // Download + store any media so it survives (Meta media URLs expire ~5 min).
    const { mediaKey, mediaMime, mediaFilename } = await this.storeMedia(msg, 'inbound');

    const message = await this.prisma.message.create({
      data: {
        wamid: msg.id,
        conversationId: conversation.id,
        direction: 'inbound',
        type,
        body,
        mediaKey,
        mediaMime,
        mediaFilename,
        status: 'delivered',
        raw: msg as unknown as Prisma.InputJsonValue,
        timestamp,
      },
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: timestamp,
        lastMessageText: body ?? `[${type}]`,
        unreadCount: { increment: 1 },
        status: 'open',
      },
    });

    this.realtime.emitNewMessage({
      conversationId: conversation.id,
      message: {
        id: message.id,
        wamid: message.wamid,
        direction: 'inbound',
        type: message.type,
        body: message.body,
        mediaUrl: mediaKey ? `/api/media/${message.id}` : null,
        status: message.status,
        senderAgentId: null,
        timestamp: timestamp.toISOString(),
      },
      contact: {
        id: contact.id,
        waId: contact.waId,
        displayName: contact.displayName,
        profileName: contact.profileName,
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

    // The button/list id the customer tapped, if any (drives flow routing).
    const replyId =
      msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? msg.button?.payload;

    // Fire automations (greeting / away / keyword / opt-out / sequence / flow triggers).
    this.events.emit('inbound.text', {
      conversationId: conversation.id,
      contactId: contact.id,
      text: body ?? '',
      replyId: replyId ?? null,
      isNewContact: !priorContact,
    });
  }

  /**
   * Coexistence echo: a message the business sent from the WhatsApp Business
   * phone app. Store it as an OUTBOUND message so it shows in the web thread.
   */
  private async handleEchoMessage(echo: WhatsAppEchoMessage): Promise<void> {
    const customerWaId = echo.to;
    if (!customerWaId) return; // can't attribute the echo to a contact

    if (await this.alreadyProcessed(`echo:${echo.id}`)) {
      this.logger.debug(`duplicate echo ${echo.id}, skipping`);
      return;
    }
    // A message we already recorded (e.g. sent via our own API) — don't dupe it.
    const existing = await this.prisma.message.findUnique({ where: { wamid: echo.id } });
    if (existing) return;

    const contact = await this.prisma.contact.upsert({
      where: { waId: customerWaId },
      create: { waId: customerWaId, phone: customerWaId },
      update: {},
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id, status: { in: ['open', 'pending'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { contactId: contact.id, status: 'open' },
      });
    }

    const { type, body } = this.extractContent(echo);
    const timestamp = new Date(parseInt(echo.timestamp, 10) * 1000);
    const { mediaKey, mediaMime, mediaFilename } = await this.storeMedia(echo, 'echo');

    const message = await this.prisma.message.create({
      data: {
        wamid: echo.id,
        conversationId: conversation.id,
        direction: 'outbound',
        type,
        body,
        mediaKey,
        mediaMime,
        mediaFilename,
        // Sent from the phone app, not by a web agent.
        status: 'sent',
        senderAgentId: null,
        raw: echo as unknown as Prisma.InputJsonValue,
        timestamp,
      },
    });

    // Outbound echo doesn't change unread count or the 24h window.
    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: timestamp, lastMessageText: body ?? `[${type}]` },
    });

    this.realtime.emitNewMessage({
      conversationId: conversation.id,
      message: {
        id: message.id,
        wamid: message.wamid,
        direction: 'outbound',
        type: message.type,
        body: message.body,
        mediaUrl: mediaKey ? `/api/media/${message.id}` : null,
        status: message.status,
        senderAgentId: null,
        timestamp: timestamp.toISOString(),
      },
      contact: {
        id: contact.id,
        waId: contact.waId,
        displayName: contact.displayName,
        profileName: contact.profileName,
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
  }

  /** Download + persist a message's media (if any) to object storage. */
  private async storeMedia(
    msg: WhatsAppInboundMessage,
    prefix: 'inbound' | 'echo',
  ): Promise<{ mediaKey: string | null; mediaMime: string | null; mediaFilename: string | null }> {
    const descriptor = this.mediaDescriptor(msg);
    if (!descriptor) return { mediaKey: null, mediaMime: null, mediaFilename: null };
    try {
      const { url, mime } = await this.whatsapp.getMediaUrl(descriptor.id);
      const buf = await this.whatsapp.downloadMedia(url);
      const key = `${prefix}/${descriptor.id}`;
      const finalMime = mime || descriptor.mime || 'application/octet-stream';
      await this.storage.put(key, buf, finalMime);
      return { mediaKey: key, mediaMime: finalMime, mediaFilename: descriptor.filename ?? null };
    } catch (e: any) {
      this.logger.warn(`media download failed for ${msg.id}: ${e?.message}`);
      return { mediaKey: null, mediaMime: null, mediaFilename: null };
    }
  }

  private async handleStatus(status: WhatsAppStatus): Promise<void> {
    // Broadcast messages are tracked as BroadcastRecipient rows (not Message),
    // so advance their delivery status too.
    const mappedForBroadcast = this.mapStatus(status.status);
    await this.prisma.broadcastRecipient.updateMany({
      where: { wamid: status.id },
      data: { status: mappedForBroadcast },
    });

    // Statuses can arrive multiple times; only advance the state forward.
    const message = await this.prisma.message.findUnique({ where: { wamid: status.id } });
    if (!message) return;

    const mapped = this.mapStatus(status.status);
    if (this.statusRank(mapped) <= this.statusRank(message.status)) return;

    const error = status.errors?.[0];
    await this.prisma.message.update({
      where: { wamid: status.id },
      data: {
        status: mapped,
        errorCode: error ? String(error.code) : undefined,
        errorMessage: error?.message ?? undefined,
      },
    });

    this.realtime.emitMessageStatus({
      conversationId: message.conversationId,
      wamid: status.id,
      status: status.status,
      errorMessage: error?.message ?? null,
    });
  }

  private extractContent(msg: WhatsAppInboundMessage): { type: MessageType; body: string | null } {
    switch (msg.type) {
      case 'text':
        return { type: 'text', body: msg.text?.body ?? '' };
      case 'image':
        return { type: 'image', body: msg.image?.caption ?? null };
      case 'video':
        return { type: 'video', body: msg.video?.caption ?? null };
      case 'audio':
        return { type: 'audio', body: null };
      case 'document':
        return { type: 'document', body: msg.document?.caption ?? msg.document?.filename ?? null };
      case 'sticker':
        return { type: 'sticker', body: null };
      case 'location': {
        const l = msg.location;
        const label = l?.name ?? l?.address ?? (l ? `${l.latitude}, ${l.longitude}` : null);
        return { type: 'location', body: label ? `📍 ${label}` : '📍 Location' };
      }
      case 'button':
        return { type: 'interactive', body: msg.button?.text ?? null };
      case 'interactive': {
        const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
        return { type: 'interactive', body: reply?.title ?? null };
      }
      // A reaction (emoji) to one of our messages.
      case 'reaction':
        return { type: 'text', body: msg.reaction?.emoji || 'Reacted' };
      // A shared contact card.
      case 'contacts': {
        const names = (msg.contacts ?? [])
          .map((c) => c.name?.formatted_name)
          .filter(Boolean)
          .join(', ');
        return { type: 'contacts', body: names ? `👤 ${names}` : '👤 Contact card' };
      }
      case 'system':
        return { type: 'system', body: msg.system?.body ?? '[system message]' };
      case 'order':
        return { type: 'unsupported', body: '🛒 Order' };
      default: {
        // Meta itself can mark a message "unsupported" (polls, view-once, newer
        // types). Surface the reason/type so it isn't an opaque label, and log it.
        const err = msg.errors?.[0];
        const detail = err?.title || err?.message || msg.type || 'unknown';
        this.logger.warn(`unsupported inbound message type "${msg.type}" (${detail})`);
        return { type: 'unsupported', body: `[unsupported: ${detail}]` };
      }
    }
  }

  /** Media id + mime + (document) filename for a media-bearing inbound message. */
  private mediaDescriptor(
    msg: WhatsAppInboundMessage,
  ): { id: string; mime?: string; filename?: string } | null {
    switch (msg.type) {
      case 'image':
        return msg.image ? { id: msg.image.id, mime: msg.image.mime_type } : null;
      case 'video':
        return msg.video ? { id: msg.video.id, mime: msg.video.mime_type } : null;
      case 'audio':
        return msg.audio ? { id: msg.audio.id, mime: msg.audio.mime_type } : null;
      case 'sticker':
        return msg.sticker ? { id: msg.sticker.id, mime: msg.sticker.mime_type } : null;
      case 'document':
        return msg.document
          ? { id: msg.document.id, mime: msg.document.mime_type, filename: msg.document.filename }
          : null;
      default:
        return null;
    }
  }

  private mapStatus(s: WhatsAppStatus['status']): MessageStatus {
    switch (s) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return 'sent';
    }
  }

  private statusRank(s: MessageStatus): number {
    const order: Record<MessageStatus, number> = {
      queued: 0,
      sent: 1,
      delivered: 2,
      read: 3,
      failed: 4,
    };
    return order[s] ?? 0;
  }
}

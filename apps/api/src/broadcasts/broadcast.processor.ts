import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { parseBody } from '../templates/templates.service';
import { BROADCAST_QUEUE } from './broadcast.queue';
import { Contact } from '@nrw/db';

interface BroadcastJob {
  broadcastId: string;
  recipientId: string;
}

/**
 * Sends one template message per recipient, throttled to respect WhatsApp rate
 * limits, and records per-recipient status. Marks the broadcast complete when
 * the last recipient has been processed.
 */
@Injectable()
export class BroadcastProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastProcessor.name);
  private worker: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit() {
    const redis = this.config.get('redis')!;
    this.worker = new Worker<BroadcastJob>(
      BROADCAST_QUEUE,
      async (job) => this.handle(job.data),
      {
        connection: { host: redis.host, port: redis.port },
        concurrency: 5,
        // ~20 sends/sec — well under Cloud API limits, gentle on quality rating.
        limiter: { max: 20, duration: 1000 },
      },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`broadcast job ${job?.id} failed: ${err.message}`),
    );
    this.logger.log('Broadcast worker started');
  }

  private async handle({ broadcastId, recipientId }: BroadcastJob) {
    const recipient = await this.prisma.broadcastRecipient.findUnique({
      where: { id: recipientId },
      include: { contact: true },
    });
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { template: true },
    });
    if (!recipient || !broadcast) return;

    const { bodyText, bodyVarCount } = parseBody(broadcast.template.components);
    const bodyParams: string[] = (broadcast.audienceFilter as any)?.bodyParams ?? [];
    const components =
      bodyVarCount > 0
        ? [
            {
              type: 'body',
              parameters: bodyParams
                .slice(0, bodyVarCount)
                .map((text) => ({ type: 'text', text })),
            },
          ]
        : undefined;

    try {
      const { wamid } = await this.whatsapp.sendTemplate(
        recipient.contact.waId,
        broadcast.template.name,
        broadcast.template.language,
        components,
      );
      await this.prisma.broadcastRecipient.update({
        where: { id: recipientId },
        data: { status: 'sent', wamid, sentAt: new Date() },
      });
      await this.logToConversation(
        recipient.contact,
        wamid,
        this.renderBody(bodyText, bodyParams),
        broadcast.template.name,
      );
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      await this.prisma.broadcastRecipient.update({
        where: { id: recipientId },
        data: {
          status: 'failed',
          errorCode: apiError ? String(apiError.code) : undefined,
          errorMessage: apiError?.message ?? err?.message,
        },
      });
    }

    // Mark the broadcast complete once nothing is left queued.
    const remaining = await this.prisma.broadcastRecipient.count({
      where: { broadcastId, status: 'queued' },
    });
    if (remaining === 0) {
      const [failed, total] = await Promise.all([
        this.prisma.broadcastRecipient.count({ where: { broadcastId, status: 'failed' } }),
        this.prisma.broadcastRecipient.count({ where: { broadcastId } }),
      ]);
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: failed >= total ? 'failed' : 'completed' },
      });
    }
  }

  /** Fill {{n}} placeholders in the template body with the broadcast's params. */
  private renderBody(bodyText: string | null, params: string[]): string | null {
    if (!bodyText) return null;
    return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => params[Number(n) - 1] ?? `{{${n}}}`);
  }

  /**
   * Record the outbound template in the contact's conversation so it shows in
   * the inbox thread. Only logs into an existing (open/pending) conversation —
   * cold broadcasts don't spawn new threads.
   */
  private async logToConversation(
    contact: Contact,
    wamid: string,
    body: string | null,
    templateName: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id, status: { in: ['open', 'pending'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversation) return;

    const now = new Date();
    const message = await this.prisma.message.create({
      data: {
        wamid,
        conversationId: conversation.id,
        direction: 'outbound',
        type: 'template',
        body,
        templateName,
        status: 'sent',
        timestamp: now,
      },
    });
    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, lastMessageText: body ?? `[template: ${templateName}]` },
    });

    this.realtime.emitNewMessage({
      conversationId: conversation.id,
      message: {
        id: message.id,
        wamid,
        direction: 'outbound',
        type: 'template',
        body,
        status: 'sent',
        senderAgentId: null,
        timestamp: now.toISOString(),
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

  async onModuleDestroy() {
    await this.worker?.close();
  }
}

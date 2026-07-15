import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { parseBody } from '../templates/templates.service';
import { BROADCAST_QUEUE } from './broadcast.queue';

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

    const { bodyVarCount } = parseBody(broadcast.template.components);
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

  async onModuleDestroy() {
    await this.worker?.close();
  }
}

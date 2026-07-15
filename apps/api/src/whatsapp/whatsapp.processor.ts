import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { WhatsAppWebhookBody } from '@nrw/shared';
import { WHATSAPP_INBOUND_QUEUE } from './whatsapp.queue';
import { WhatsappIngestService } from './whatsapp-ingest.service';

/**
 * BullMQ worker that drains the inbound queue and hands each webhook payload to
 * the ingest service. Running it in-process keeps the scaffold simple; it can
 * be split into a dedicated worker container later without code changes.
 */
@Injectable()
export class WhatsappProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappProcessor.name);
  private worker: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly ingest: WhatsappIngestService,
  ) {}

  onModuleInit() {
    const redis = this.config.get('redis')!;
    this.worker = new Worker<WhatsAppWebhookBody>(
      WHATSAPP_INBOUND_QUEUE,
      async (job) => {
        await this.ingest.handleWebhook(job.data);
      },
      { connection: { host: redis.host, port: redis.port }, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
    this.logger.log('WhatsApp inbound worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}

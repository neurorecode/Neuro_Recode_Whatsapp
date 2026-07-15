import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { WhatsAppWebhookBody } from '@nrw/shared';

export const WHATSAPP_INBOUND_QUEUE = 'whatsapp-inbound';

@Injectable()
export class WhatsappQueue implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redis = this.config.get('redis')!;
    this.queue = new Queue(WHATSAPP_INBOUND_QUEUE, {
      connection: { host: redis.host, port: redis.port },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async enqueue(body: WhatsAppWebhookBody) {
    await this.queue.add('event', body);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}

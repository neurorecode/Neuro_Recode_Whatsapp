import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export const BROADCAST_QUEUE = 'broadcast-send';

@Injectable()
export class BroadcastQueue implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redis = this.config.get('redis')!;
    this.queue = new Queue(BROADCAST_QUEUE, {
      connection: { host: redis.host, port: redis.port },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async enqueue(broadcastId: string, recipientIds: string[]) {
    await this.queue.addBulk(
      recipientIds.map((recipientId) => ({
        name: 'send',
        data: { broadcastId, recipientId },
      })),
    );
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}

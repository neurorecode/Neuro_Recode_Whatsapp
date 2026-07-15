import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

/** Wraps MinIO (S3-compatible) for storing inbound/outbound WhatsApp media. */
@Injectable()
export class MediaStorageService implements OnModuleInit {
  private readonly logger = new Logger(MediaStorageService.name);
  private client: MinioClient;
  private bucket: string;

  constructor(private readonly config: ConfigService) {
    const m = this.config.get('minio')!;
    this.bucket = m.bucket;
    this.client = new MinioClient({
      endPoint: m.endpoint,
      port: m.port,
      useSSL: m.useSSL,
      accessKey: m.accessKey,
      secretKey: m.secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket ${this.bucket}`);
      }
    } catch (err: any) {
      this.logger.error(`MinIO init failed: ${err?.message}`);
    }
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': mime,
    });
  }

  async getStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async stat(key: string): Promise<{ size: number; mime: string }> {
    const s = await this.client.statObject(this.bucket, key);
    return { size: s.size, mime: s.metaData['content-type'] ?? 'application/octet-stream' };
  }
}

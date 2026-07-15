import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { WhatsAppWebhookBody } from '@nrw/shared';
import { WhatsappSignatureGuard } from './whatsapp-signature.guard';
import { WhatsappQueue } from './whatsapp.queue';

@Controller('webhooks/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly queue: WhatsappQueue,
  ) {}

  /**
   * Meta webhook verification handshake. Meta calls this once when you set the
   * callback URL. Echo back hub.challenge if the verify token matches.
   */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = this.config.get('whatsapp')!.verifyToken as string;
    if (mode === 'subscribe' && token && token === expected) {
      this.logger.log('Webhook verified by Meta');
      return res.status(200).send(challenge);
    }
    this.logger.warn('Webhook verification failed');
    return res.status(403).send('Forbidden');
  }

  /**
   * Inbound events (messages + statuses). Verify signature, enqueue for async
   * processing, and ack immediately so Meta does not retry.
   */
  @Post()
  @HttpCode(200)
  @UseGuards(WhatsappSignatureGuard)
  async receive(@Body() body: WhatsAppWebhookBody, @Req() _req: unknown) {
    await this.queue.enqueue(body);
    return { received: true };
  }
}

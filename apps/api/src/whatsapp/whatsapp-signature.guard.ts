import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body
 * using the app secret. Requires `rawBody: true` on the Nest app so we hash
 * the exact bytes Meta sent.
 */
@Injectable()
export class WhatsappSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WhatsappSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const appSecret = this.config.get('whatsapp')!.appSecret as string;

    // If no secret configured (local dev), don't hard-block — just warn.
    if (!appSecret) {
      this.logger.warn('WHATSAPP_APP_SECRET not set — skipping signature check');
      return true;
    }

    const header: string | undefined = req.headers['x-hub-signature-256'];
    const raw: Buffer | undefined = req.rawBody;
    if (!header || !raw) {
      this.logger.warn('Missing signature header or raw body');
      return false;
    }

    const expected =
      'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');

    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      this.logger.warn('Invalid webhook signature');
      return false;
    }
    return true;
  }
}

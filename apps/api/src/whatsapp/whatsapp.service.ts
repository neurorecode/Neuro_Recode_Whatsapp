import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface SendResult {
  wamid: string;
}

/**
 * Thin client over the WhatsApp Cloud API (Graph API). Handles outbound sends.
 * Media / template / calling endpoints are added in later phases.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const wa = this.config.get('whatsapp')!;
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${wa.graphVersion}`,
      headers: { Authorization: `Bearer ${wa.accessToken}` },
      timeout: 15000,
    });
  }

  private get phoneNumberId(): string {
    return this.config.get('whatsapp')!.phoneNumberId;
  }

  private get wabaId(): string {
    return this.config.get('whatsapp')!.wabaId;
  }

  private get graphVersion(): string {
    return this.config.get('whatsapp')!.graphVersion;
  }

  /** Send a free-form text message (only valid inside the 24h service window). */
  async sendText(to: string, body: string): Promise<SendResult> {
    const res = await this.http.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body, preview_url: true },
    });
    const wamid = res.data?.messages?.[0]?.id as string;
    this.logger.debug(`sent text to ${to}: ${wamid}`);
    return { wamid };
  }

  /** List message templates from the WABA (follows pagination up to 10 pages). */
  async listTemplates(): Promise<any[]> {
    const all: any[] = [];
    let path: string | null =
      `/${this.wabaId}/message_templates?limit=100&fields=name,status,category,language,components`;
    for (let i = 0; i < 10 && path; i++) {
      const res = await this.http.get(path);
      all.push(...(res.data?.data ?? []));
      const next: string | undefined = res.data?.paging?.next;
      path = next ? next.replace(`https://graph.facebook.com/${this.graphVersion}`, '') : null;
    }
    return all;
  }

  /**
   * Send an approved template message. `components` carries variable values
   * (e.g. body parameters); omit for templates with no variables.
   */
  async sendTemplate(
    to: string,
    name: string,
    language: string,
    components?: unknown[],
  ): Promise<SendResult> {
    const template: Record<string, unknown> = { name, language: { code: language } };
    if (components && components.length) template.components = components;
    const res = await this.http.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template,
    });
    return { wamid: res.data?.messages?.[0]?.id as string };
  }

  /** Mark an inbound message as read (blue ticks on the customer side). */
  async markRead(wamid: string): Promise<void> {
    try {
      await this.http.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: wamid,
      });
    } catch (err: any) {
      this.logger.warn(`markRead failed for ${wamid}: ${err?.message}`);
    }
  }
}

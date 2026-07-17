import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { parseBody } from '../templates/templates.service';
import { Contact, Message, Template } from '@nrw/db';

function renderBody(bodyText: string | null, params: string[]): string | null {
  if (!bodyText) return null;
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => params[Number(n) - 1] ?? `{{${n}}}`);
}

/**
 * Sends outbound messages on behalf of automations (no human agent). Used by the
 * auto-reply engine and drip sequences. Mirrors the outbound bookkeeping the
 * messages service does so these show in the thread and update the inbox live.
 */
@Injectable()
export class AutomationSenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async conversationFor(contactId: string): Promise<{ id: string }> {
    const existing = await this.prisma.conversation.findFirst({
      where: { contactId, status: { in: ['open', 'pending'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({ data: { contactId, status: 'open' } });
  }

  async sendText(contact: Contact, body: string): Promise<void> {
    const convo = await this.conversationFor(contact.id);
    const { wamid } = await this.whatsapp.sendText(contact.waId, body);
    const msg = await this.prisma.message.create({
      data: {
        wamid,
        conversationId: convo.id,
        direction: 'outbound',
        type: 'text',
        body,
        status: 'sent',
        timestamp: new Date(),
      },
    });
    await this.finish(convo.id, contact, msg, body);
  }

  async sendTemplate(contact: Contact, template: Template, bodyParams: string[]): Promise<void> {
    const convo = await this.conversationFor(contact.id);
    const { bodyText, bodyVarCount } = parseBody(template.components);
    const components =
      bodyVarCount > 0
        ? [
            {
              type: 'body',
              parameters: (bodyParams ?? [])
                .slice(0, bodyVarCount)
                .map((text) => ({ type: 'text', text })),
            },
          ]
        : undefined;
    const { wamid } = await this.whatsapp.sendTemplate(
      contact.waId,
      template.name,
      template.language,
      components,
    );
    const rendered = renderBody(bodyText, bodyParams ?? []);
    const msg = await this.prisma.message.create({
      data: {
        wamid,
        conversationId: convo.id,
        direction: 'outbound',
        type: 'template',
        body: rendered,
        templateName: template.name,
        status: 'sent',
        timestamp: new Date(),
      },
    });
    await this.finish(convo.id, contact, msg, rendered ?? `[template: ${template.name}]`);
  }

  async sendButtons(
    contact: Contact,
    text: string,
    buttons: { id: string; title: string }[],
  ): Promise<void> {
    const convo = await this.conversationFor(contact.id);
    const { wamid } = await this.whatsapp.sendInteractiveButtons(contact.waId, text, buttons);
    const summary = `${text}\n[${buttons.map((b) => b.title).join(' · ')}]`;
    const msg = await this.prisma.message.create({
      data: {
        wamid,
        conversationId: convo.id,
        direction: 'outbound',
        type: 'interactive',
        body: summary,
        status: 'sent',
        timestamp: new Date(),
      },
    });
    await this.finish(convo.id, contact, msg, text);
  }

  async sendList(
    contact: Contact,
    text: string,
    buttonText: string,
    rows: { id: string; title: string; description?: string }[],
  ): Promise<void> {
    const convo = await this.conversationFor(contact.id);
    const { wamid } = await this.whatsapp.sendInteractiveList(contact.waId, text, buttonText, [
      { rows },
    ]);
    const summary = `${text}\n[${rows.map((r) => r.title).join(' · ')}]`;
    const msg = await this.prisma.message.create({
      data: {
        wamid,
        conversationId: convo.id,
        direction: 'outbound',
        type: 'interactive',
        body: summary,
        status: 'sent',
        timestamp: new Date(),
      },
    });
    await this.finish(convo.id, contact, msg, text);
  }

  private async finish(
    conversationId: string,
    contact: Contact,
    msg: Message,
    lastText: string,
  ): Promise<void> {
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: msg.timestamp, lastMessageText: lastText },
    });
    this.realtime.emitNewMessage({
      conversationId,
      message: {
        id: msg.id,
        wamid: msg.wamid,
        direction: 'outbound',
        type: msg.type,
        body: msg.body,
        status: msg.status,
        senderAgentId: null,
        timestamp: msg.timestamp.toISOString(),
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
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

export interface AiSettingInput {
  knowledgeBase?: string;
  tone?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const a = this.config.get<{ apiKey: string; model: string }>('anthropic')!;
    this.model = a.model;
    if (a.apiKey) this.client = new Anthropic({ apiKey: a.apiKey });
  }

  get configured(): boolean {
    return !!this.client;
  }

  private ensure(): Anthropic {
    if (!this.client) {
      throw new BadRequestException(
        'AI is not configured — set ANTHROPIC_API_KEY on the server to enable AI assist.',
      );
    }
    return this.client;
  }

  // ---- Knowledge-base settings ----
  getSetting() {
    return this.prisma.aiSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  updateSetting(input: AiSettingInput) {
    return this.prisma.aiSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', knowledgeBase: input.knowledgeBase, tone: input.tone },
      update: { knowledgeBase: input.knowledgeBase, tone: input.tone },
    });
  }

  private textOf(resp: Anthropic.Message): string {
    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }

  private async transcript(conversationId: string): Promise<{ name: string; lines: string }> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        messages: { orderBy: { timestamp: 'asc' }, take: 40 },
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    const name = convo.contact.displayName || convo.contact.profileName || convo.contact.waId;
    const lines = convo.messages
      .map((m) => `${m.direction === 'inbound' ? name : 'Agent'}: ${m.body ?? `[${m.type}]`}`)
      .join('\n');
    return { name, lines };
  }

  /** Draft the next agent reply. Agent reviews before sending (human in the loop). */
  async suggestReply(conversationId: string): Promise<{ draft: string }> {
    const client = this.ensure();
    const setting = await this.getSetting();
    const { name, lines } = await this.transcript(conversationId);

    const system = `You are a WhatsApp customer-support assistant for Neuro Recode, a mental-wellness and coaching brand. You draft a reply that a human agent will review and edit before sending.

Tone: ${setting.tone}
${setting.knowledgeBase ? `\nBusiness knowledge / FAQs (use only what's relevant):\n${setting.knowledgeBase}\n` : ''}
Rules:
- Output ONLY the reply message text, ready to send. No preamble, no surrounding quotes, no "Agent:" prefix.
- Keep it concise and natural for WhatsApp.
- Never invent facts, prices, or policies not in the knowledge base — if unsure, offer to check.
- SAFETY: if the customer shows any sign of crisis, self-harm, or acute distress, do not counsel or diagnose. Respond with warmth, encourage them to seek immediate professional help, and keep it brief so a human takes over.`;

    const resp = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system,
      messages: [
        {
          role: 'user',
          content: `Conversation so far:\n${lines}\n\nDraft the next reply from the Agent to ${name}.`,
        },
      ],
    });
    return { draft: this.textOf(resp) };
  }

  /** Free-form assistant chat for agents (the floating copilot). */
  async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ reply: string }> {
    const client = this.ensure();
    const setting = await this.getSetting();
    const system = `You are the AI assistant embedded in Neuro Recode's WhatsApp support console, helping the support agents (staff — not the customers directly). Help them answer customer questions, draft replies, summarize, translate, and look things up.

When drafting a customer-facing message, use this tone: ${setting.tone}
${setting.knowledgeBase ? `\nBusiness knowledge / FAQs (rely on this; don't invent facts):\n${setting.knowledgeBase}\n` : ''}
Be concise and practical. If a situation involves customer crisis, self-harm, or acute distress, advise the agent to escalate to a human and share professional-help resources — never counsel or diagnose directly.`;

    const resp = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system,
      messages: messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content })),
    });
    return { reply: this.textOf(resp) };
  }

  /** Summarize the conversation for an agent picking it up. */
  async summarize(conversationId: string): Promise<{ summary: string }> {
    const client = this.ensure();
    const { name, lines } = await this.transcript(conversationId);
    const resp = await client.messages.create({
      model: this.model,
      max_tokens: 512,
      thinking: { type: 'adaptive' },
      system:
        'You summarize a WhatsApp support conversation for an agent about to pick it up. Be factual and brief.',
      messages: [
        {
          role: 'user',
          content: `Conversation with ${name}:\n${lines}\n\nGive a 2–3 sentence summary: what the customer wants, the current status, and the suggested next step. Plain text, no headings.`,
        },
      ],
    });
    return { summary: this.textOf(resp) };
  }
}

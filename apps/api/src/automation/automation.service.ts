import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationSenderService } from './automation-sender.service';
import { isWithinBusinessHours } from './business-hours.util';
import { AutoReplyRule, Prisma } from '@nrw/db';

export interface InboundTextEvent {
  conversationId: string;
  contactId: string;
  text: string;
  replyId?: string | null;
  isNewContact: boolean;
}

const OPT_OUT = new Set(['STOP', 'UNSUBSCRIBE', 'STOP PROMOTIONS', 'CANCEL']);
const OPT_IN = new Set(['START', 'SUBSCRIBE', 'UNSTOP', 'RESUME']);

export interface AutomationConfigInput {
  timezone?: string;
  businessHours?: unknown;
  greetingEnabled?: boolean;
  greetingText?: string | null;
  awayEnabled?: boolean;
  awayText?: string | null;
  autoReplyCooldownMin?: number;
}

export interface RuleInput {
  name: string;
  enabled?: boolean;
  matchType?: string;
  keywords: string[];
  replyText: string;
  priority?: number;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: AutomationSenderService,
  ) {}

  // ---- Config ----
  async getConfig() {
    return this.prisma.automationConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  async updateConfig(input: AutomationConfigInput) {
    return this.prisma.automationConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        timezone: input.timezone,
        businessHours: (input.businessHours as Prisma.InputJsonValue) ?? undefined,
        greetingEnabled: input.greetingEnabled,
        greetingText: input.greetingText,
        awayEnabled: input.awayEnabled,
        awayText: input.awayText,
        autoReplyCooldownMin: input.autoReplyCooldownMin,
      },
      update: {
        timezone: input.timezone,
        businessHours: (input.businessHours as Prisma.InputJsonValue) ?? undefined,
        greetingEnabled: input.greetingEnabled,
        greetingText: input.greetingText,
        awayEnabled: input.awayEnabled,
        awayText: input.awayText,
        autoReplyCooldownMin: input.autoReplyCooldownMin,
      },
    });
  }

  // ---- Keyword rules ----
  listRules() {
    return this.prisma.autoReplyRule.findMany({ orderBy: [{ priority: 'desc' }, { name: 'asc' }] });
  }

  createRule(input: RuleInput) {
    return this.prisma.autoReplyRule.create({
      data: {
        name: input.name,
        enabled: input.enabled ?? true,
        matchType: input.matchType ?? 'contains',
        keywords: input.keywords,
        replyText: input.replyText,
        priority: input.priority ?? 0,
      },
    });
  }

  updateRule(id: string, input: Partial<RuleInput>) {
    return this.prisma.autoReplyRule.update({
      where: { id },
      data: {
        name: input.name,
        enabled: input.enabled,
        matchType: input.matchType,
        keywords: input.keywords,
        replyText: input.replyText,
        priority: input.priority,
      },
    });
  }

  deleteRule(id: string) {
    return this.prisma.autoReplyRule.delete({ where: { id } });
  }

  private ruleMatches(rule: AutoReplyRule, body: string): boolean {
    const text = body.toLowerCase();
    return rule.keywords.some((k) => {
      const kw = k.trim().toLowerCase();
      if (!kw) return false;
      switch (rule.matchType) {
        case 'exact':
          return text === kw;
        case 'starts_with':
          return text.startsWith(kw);
        default:
          return text.includes(kw);
      }
    });
  }

  // ---- Inbound evaluation ----
  @OnEvent('inbound.text')
  async onInboundText(payload: InboundTextEvent): Promise<void> {
    try {
      await this.evaluate(payload);
    } catch (e: any) {
      this.logger.warn(`automation evaluate failed: ${e?.message}`);
    }
  }

  private async evaluate({ conversationId, contactId, text }: InboundTextEvent): Promise<void> {
    const body = (text || '').trim();

    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) return;

    // 1. Opt-out / opt-in — always honored, ignores cooldown (text only).
    if (body) {
      const upper = body.toUpperCase();
      if (OPT_OUT.has(upper)) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: { optInStatus: 'opted_out' },
        });
        await this.sender.sendText(
          contact,
          "You've been unsubscribed and won't receive further broadcasts. Reply START to opt back in.",
        );
        return;
      }
      if (OPT_IN.has(upper)) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: { optInStatus: 'opted_in' },
        });
        await this.sender.sendText(contact, "You're subscribed again — welcome back!");
        return;
      }
    }

    const config = await this.getConfig();
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo) return;

    const cooldownMs = (config.autoReplyCooldownMin ?? 60) * 60_000;
    const onCooldown =
      !!convo.lastAutoReplyAt && Date.now() - convo.lastAutoReplyAt.getTime() < cooldownMs;

    // 2. Keyword rules (highest-priority match wins), rate-limited to avoid loops.
    if (body) {
      const rules = await this.prisma.autoReplyRule.findMany({
        where: { enabled: true },
        orderBy: { priority: 'desc' },
      });
      const match = rules.find((r) => this.ruleMatches(r, body));
      if (match && !onCooldown) {
        await this.sender.sendText(contact, match.replyText);
        await this.touch(conversationId);
        return;
      }
    }

    // 3. First-contact greeting — once per contact, ever.
    if (config.greetingEnabled && config.greetingText && !contact.greetedAt) {
      await this.sender.sendText(contact, config.greetingText);
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { greetedAt: new Date() },
      });
      await this.touch(conversationId);
      return;
    }

    // 4. Away message — outside business hours.
    if (config.awayEnabled && config.awayText && !onCooldown && !isWithinBusinessHours(config)) {
      await this.sender.sendText(contact, config.awayText);
      await this.touch(conversationId);
      return;
    }
  }

  private async touch(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastAutoReplyAt: new Date() },
    });
  }
}

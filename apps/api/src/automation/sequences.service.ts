import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationSenderService } from './automation-sender.service';
import type { InboundTextEvent } from './automation.service';

export interface SequenceStepInput {
  delayHours: number;
  templateId: string;
  bodyParams?: string[];
}

export interface SequenceInput {
  name: string;
  enabled?: boolean;
  trigger?: string; // manual | first_contact | keyword | tag
  triggerTag?: string | null;
  keywords?: string[];
  steps: SequenceStepInput[];
}

@Injectable()
export class SequencesService {
  private readonly logger = new Logger(SequencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: AutomationSenderService,
  ) {}

  async list() {
    const sequences = await this.prisma.sequence.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { order: 'asc' }, include: { template: true } },
        _count: { select: { enrollments: true } },
      },
    });
    return sequences.map((s) => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      trigger: s.trigger,
      triggerTag: s.triggerTag,
      keywords: s.keywords,
      enrolled: s._count.enrollments,
      steps: s.steps.map((st) => ({
        id: st.id,
        order: st.order,
        delayHours: st.delayHours,
        templateId: st.templateId,
        templateName: st.template.name,
        bodyParams: st.bodyParams,
      })),
    }));
  }

  async create(input: SequenceInput) {
    if (!input.steps?.length) throw new BadRequestException('A sequence needs at least one step');
    return this.prisma.sequence.create({
      data: {
        name: input.name,
        enabled: input.enabled ?? true,
        trigger: input.trigger ?? 'manual',
        triggerTag: input.triggerTag ?? null,
        keywords: input.keywords ?? [],
        steps: {
          create: input.steps.map((st, i) => ({
            order: i,
            delayHours: st.delayHours,
            templateId: st.templateId,
            bodyParams: st.bodyParams ?? [],
          })),
        },
      },
    });
  }

  async update(id: string, input: SequenceInput) {
    const existing = await this.prisma.sequence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sequence not found');
    // Replace steps wholesale for simplicity.
    await this.prisma.sequenceStep.deleteMany({ where: { sequenceId: id } });
    return this.prisma.sequence.update({
      where: { id },
      data: {
        name: input.name,
        enabled: input.enabled,
        trigger: input.trigger,
        triggerTag: input.triggerTag ?? null,
        keywords: input.keywords ?? [],
        steps: {
          create: (input.steps ?? []).map((st, i) => ({
            order: i,
            delayHours: st.delayHours,
            templateId: st.templateId,
            bodyParams: st.bodyParams ?? [],
          })),
        },
      },
    });
  }

  setEnabled(id: string, enabled: boolean) {
    return this.prisma.sequence.update({ where: { id }, data: { enabled } });
  }

  delete(id: string) {
    return this.prisma.sequence.delete({ where: { id } });
  }

  // ---- Enrollment ----
  private async firstDelayMs(sequenceId: string): Promise<number | null> {
    const step = await this.prisma.sequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { order: 'asc' },
    });
    if (!step) return null;
    return step.delayHours * 3_600_000;
  }

  async enrollContact(sequenceId: string, contactId: string): Promise<boolean> {
    const existing = await this.prisma.sequenceEnrollment.findUnique({
      where: { sequenceId_contactId: { sequenceId, contactId } },
    });
    if (existing) return false;
    const delay = await this.firstDelayMs(sequenceId);
    if (delay === null) return false;
    await this.prisma.sequenceEnrollment.create({
      data: {
        sequenceId,
        contactId,
        currentStep: 0,
        status: 'active',
        nextRunAt: new Date(Date.now() + delay),
      },
    });
    return true;
  }

  async enrollByTag(sequenceId: string, tag: string): Promise<number> {
    const contacts = await this.prisma.contact.findMany({
      where: { tags: { has: tag }, optInStatus: { not: 'opted_out' } },
      select: { id: true },
    });
    let enrolled = 0;
    for (const c of contacts) {
      if (await this.enrollContact(sequenceId, c.id)) enrolled++;
    }
    return enrolled;
  }

  // ---- Trigger-based enrollment on inbound ----
  @OnEvent('inbound.text')
  async onInboundText(payload: InboundTextEvent): Promise<void> {
    try {
      const body = (payload.text || '').trim().toLowerCase();
      const sequences = await this.prisma.sequence.findMany({
        where: { enabled: true, trigger: { in: ['first_contact', 'keyword'] } },
      });
      for (const seq of sequences) {
        if (seq.trigger === 'first_contact' && !payload.isNewContact) continue;
        if (seq.trigger === 'keyword') {
          const hit = seq.keywords.some((k) => k.trim() && body.includes(k.trim().toLowerCase()));
          if (!hit) continue;
        }
        await this.enrollContact(seq.id, payload.contactId);
      }
    } catch (e: any) {
      this.logger.warn(`sequence enroll failed: ${e?.message}`);
    }
  }

  // ---- Scheduler tick: run due steps ----
  async runDueSteps(): Promise<void> {
    const due = await this.prisma.sequenceEnrollment.findMany({
      where: { status: 'active', nextRunAt: { lte: new Date() } },
      include: {
        contact: true,
        sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
      },
      take: 200,
    });
    for (const e of due) {
      await this.runStep(e).catch((err) =>
        this.logger.warn(`sequence step failed for ${e.id}: ${err?.message}`),
      );
    }
  }

  private async runStep(e: any): Promise<void> {
    const steps = e.sequence.steps as Array<{
      order: number;
      delayHours: number;
      templateId: string;
      bodyParams: string[];
    }>;

    // Stop if the sequence was disabled or the contact opted out.
    if (!e.sequence.enabled || e.contact.optInStatus === 'opted_out') {
      await this.prisma.sequenceEnrollment.update({
        where: { id: e.id },
        data: { status: 'cancelled', nextRunAt: null },
      });
      return;
    }

    const step = steps[e.currentStep];
    if (!step) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: e.id },
        data: { status: 'completed', nextRunAt: null },
      });
      return;
    }

    const template = await this.prisma.template.findUnique({ where: { id: step.templateId } });
    if (template && template.status === 'approved') {
      try {
        await this.sender.sendTemplate(e.contact, template, step.bodyParams);
      } catch (err: any) {
        this.logger.warn(`sequence template send failed: ${err?.message}`);
      }
    }

    const nextIndex = e.currentStep + 1;
    const nextStep = steps[nextIndex];
    if (nextStep) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: e.id },
        data: {
          currentStep: nextIndex,
          nextRunAt: new Date(Date.now() + nextStep.delayHours * 3_600_000),
        },
      });
    } else {
      await this.prisma.sequenceEnrollment.update({
        where: { id: e.id },
        data: { currentStep: nextIndex, status: 'completed', nextRunAt: null },
      });
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { BroadcastQueue } from './broadcast.queue';
import { Prisma } from '@nrw/db';

export interface CreateBroadcastInput {
  name: string;
  templateId: string;
  tags: string[];
  bodyParams: string[];
}

const EMPTY_COUNTS = { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly queue: BroadcastQueue,
  ) {}

  async create(input: CreateBroadcastInput) {
    const template = await this.prisma.template.findUnique({ where: { id: input.templateId } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.status !== 'approved') {
      throw new BadRequestException('Template must be approved by Meta before broadcasting');
    }

    const audience = await this.contacts.resolveAudience(input.tags ?? []);
    if (audience.length === 0) {
      throw new BadRequestException('No opted-in contacts match the selected tags');
    }

    const broadcast = await this.prisma.broadcast.create({
      data: {
        name: input.name,
        templateId: input.templateId,
        audienceFilter: {
          tags: input.tags ?? [],
          bodyParams: input.bodyParams ?? [],
        } as Prisma.InputJsonValue,
        status: 'running',
        recipients: { create: audience.map((a) => ({ contactId: a.id })) },
      },
      include: { recipients: { select: { id: true } } },
    });

    await this.queue.enqueue(
      broadcast.id,
      broadcast.recipients.map((r) => r.id),
    );

    return this.get(broadcast.id);
  }

  async list() {
    const broadcasts = await this.prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { template: true, _count: { select: { recipients: true } } },
    });
    const grouped = await this.prisma.broadcastRecipient.groupBy({
      by: ['broadcastId', 'status'],
      _count: { _all: true },
    });

    const countsByBroadcast = new Map<string, Record<string, number>>();
    for (const g of grouped) {
      const c = countsByBroadcast.get(g.broadcastId) ?? { ...EMPTY_COUNTS };
      c[g.status] = g._count._all;
      countsByBroadcast.set(g.broadcastId, c);
    }

    return broadcasts.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      templateName: b.template.name,
      total: b._count.recipients,
      counts: countsByBroadcast.get(b.id) ?? { ...EMPTY_COUNTS },
    }));
  }

  async get(id: string) {
    const b = await this.prisma.broadcast.findUnique({
      where: { id },
      include: {
        template: true,
        recipients: { include: { contact: true }, orderBy: { id: 'asc' }, take: 500 },
      },
    });
    if (!b) throw new NotFoundException('Broadcast not found');

    const counts: Record<string, number> = { ...EMPTY_COUNTS };
    for (const r of b.recipients) counts[r.status] = (counts[r.status] ?? 0) + 1;

    return {
      id: b.id,
      name: b.name,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      template: { id: b.template.id, name: b.template.name, language: b.template.language },
      audienceFilter: b.audienceFilter,
      total: b.recipients.length,
      counts,
      recipients: b.recipients.map((r) => ({
        id: r.id,
        contactName: r.contact.displayName || r.contact.profileName || r.contact.waId,
        waId: r.contact.waId,
        status: r.status,
        errorMessage: r.errorMessage,
      })),
    };
  }
}

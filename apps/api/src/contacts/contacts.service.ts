import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OptInStatus, Prisma } from '@nrw/db';

export interface ContactManageDto {
  id: string;
  waId: string;
  displayName: string | null;
  profileName: string | null;
  tags: string[];
  optInStatus: string;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tag?: string, q?: string): Promise<ContactManageDto[]> {
    const where: Prisma.ContactWhereInput = {};
    if (tag) where.tags = { has: tag };
    if (q) {
      where.OR = [
        { waId: { contains: q } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { profileName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return rows.map((c) => ({
      id: c.id,
      waId: c.waId,
      displayName: c.displayName,
      profileName: c.profileName,
      tags: c.tags,
      optInStatus: c.optInStatus,
    }));
  }

  /** Distinct tags across all contacts (deduped in memory — fine at this scale). */
  async tags(): Promise<string[]> {
    const rows = await this.prisma.contact.findMany({ select: { tags: true } });
    const set = new Set<string>();
    for (const r of rows) for (const t of r.tags) set.add(t);
    return Array.from(set).sort();
  }

  async update(
    id: string,
    data: { tags?: string[]; optInStatus?: string },
  ): Promise<ContactManageDto> {
    const c = await this.prisma.contact.update({
      where: { id },
      data: {
        tags: data.tags,
        optInStatus: data.optInStatus ? (data.optInStatus as OptInStatus) : undefined,
      },
    });
    return {
      id: c.id,
      waId: c.waId,
      displayName: c.displayName,
      profileName: c.profileName,
      tags: c.tags,
      optInStatus: c.optInStatus,
    };
  }

  /** Resolve broadcast audience: opted-in contacts, optionally filtered by tags. */
  async resolveAudience(tags: string[]): Promise<{ id: string; waId: string }[]> {
    return this.prisma.contact.findMany({
      where: {
        optInStatus: 'opted_in',
        ...(tags.length ? { tags: { hasSome: tags } } : {}),
      },
      select: { id: true, waId: true },
    });
  }
}

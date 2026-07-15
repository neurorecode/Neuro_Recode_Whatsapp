import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CannedResponseDto {
  id: string;
  title: string;
  body: string;
}

@Injectable()
export class CannedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CannedResponseDto[]> {
    const rows = await this.prisma.cannedResponse.findMany({ orderBy: { title: 'asc' } });
    return rows.map((c) => ({ id: c.id, title: c.title, body: c.body }));
  }

  async create(agentId: string, title: string, body: string): Promise<CannedResponseDto> {
    const c = await this.prisma.cannedResponse.create({
      data: { title, body, createdBy: agentId },
    });
    return { id: c.id, title: c.title, body: c.body };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.cannedResponse.delete({ where: { id } });
  }
}

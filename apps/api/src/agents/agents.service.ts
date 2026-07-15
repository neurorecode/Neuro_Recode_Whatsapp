import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRole } from '@nrw/db';

export interface AgentListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  presence: string;
}

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AgentListItem[]> {
    const rows = await this.prisma.agent.findMany({ orderBy: { name: 'asc' } });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      presence: a.presence,
    }));
  }

  async create(input: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Promise<AgentListItem> {
    const existing = await this.prisma.agent.findUnique({ where: { email: input.email } });
    if (existing) throw new BadRequestException('An agent with that email already exists');
    const passwordHash = await argon2.hash(input.password);
    const a = await this.prisma.agent.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: (input.role as AgentRole) ?? 'agent',
      },
    });
    return { id: a.id, name: a.name, email: a.email, role: a.role, presence: a.presence };
  }
}

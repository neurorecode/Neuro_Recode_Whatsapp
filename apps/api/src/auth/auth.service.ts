import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginResponse } from '@nrw/shared';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Seed the initial admin agent on first boot so the inbox is usable. */
  async onModuleInit() {
    const { email, password, name } = this.config.get('seedAdmin')!;
    const existing = await this.prisma.agent.findUnique({ where: { email } });
    if (existing) return;
    const passwordHash = await argon2.hash(password);
    await this.prisma.agent.create({
      data: { email, name, passwordHash, role: 'admin' },
    });
    this.logger.log(`Seeded admin agent ${email}`);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const agent = await this.prisma.agent.findUnique({ where: { email } });
    if (!agent) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(agent.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.jwt.signAsync({
      sub: agent.id,
      email: agent.email,
      role: agent.role,
    });

    return {
      accessToken,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        presence: agent.presence,
      },
    };
  }
}

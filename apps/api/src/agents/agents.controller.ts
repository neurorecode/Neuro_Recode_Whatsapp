import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AgentsService } from './agents.service';

class CreateAgentDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsIn(['agent', 'admin'])
  role?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list() {
    return this.agents.list();
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.agents.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role ?? 'agent',
    });
  }
}

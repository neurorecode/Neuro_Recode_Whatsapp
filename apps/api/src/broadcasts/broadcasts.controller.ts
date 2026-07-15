import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BroadcastsService } from './broadcasts.service';

class CreateBroadcastDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  templateId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParams?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Get()
  list() {
    return this.broadcasts.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.broadcasts.get(id);
  }

  @Post()
  create(@Body() dto: CreateBroadcastDto) {
    return this.broadcasts.create({
      name: dto.name,
      templateId: dto.templateId,
      tags: dto.tags ?? [],
      bodyParams: dto.bodyParams ?? [],
    });
  }
}

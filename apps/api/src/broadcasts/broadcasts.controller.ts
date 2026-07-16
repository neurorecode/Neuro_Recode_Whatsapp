import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
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

class ImportRecipientDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  params?: string[];
}

class ImportBroadcastDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  templateId: string;

  @IsOptional()
  @IsString()
  listTag?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ImportRecipientDto)
  recipients: ImportRecipientDto[];
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

  @Post('import')
  importList(@Body() dto: ImportBroadcastDto) {
    return this.broadcasts.createFromImport({
      name: dto.name,
      templateId: dto.templateId,
      listTag: dto.listTag,
      recipients: dto.recipients,
    });
  }
}

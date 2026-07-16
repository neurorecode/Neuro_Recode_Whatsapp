import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SequencesService } from './sequences.service';

class StepDto {
  @IsInt() @Min(0) delayHours: number;
  @IsString() @MinLength(1) templateId: string;
  @IsOptional() @IsArray() @IsString({ each: true }) bodyParams?: string[];
}

class SequenceDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() trigger?: string;
  @IsOptional() @IsString() triggerTag?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => StepDto) steps: StepDto[];
}

class EnrollDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() tag?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequences: SequencesService) {}

  @Get()
  list() {
    return this.sequences.list();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: SequenceDto) {
    return this.sequences.create(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: SequenceDto) {
    return this.sequences.update(id, dto);
  }

  @Patch(':id/enabled')
  @UseGuards(AdminGuard)
  setEnabled(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.sequences.setEnabled(id, enabled);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.sequences.delete(id);
  }

  @Post(':id/enroll')
  @UseGuards(AdminGuard)
  async enroll(@Param('id') id: string, @Body() dto: EnrollDto) {
    if (dto.tag) {
      const enrolled = await this.sequences.enrollByTag(id, dto.tag);
      return { enrolled };
    }
    if (dto.contactId) {
      const ok = await this.sequences.enrollContact(id, dto.contactId);
      return { enrolled: ok ? 1 : 0 };
    }
    return { enrolled: 0 };
  }
}

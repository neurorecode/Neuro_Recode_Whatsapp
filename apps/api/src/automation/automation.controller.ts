import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AutomationService } from './automation.service';

class ConfigDto {
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() businessHours?: unknown;
  @IsOptional() @IsBoolean() greetingEnabled?: boolean;
  @IsOptional() @IsString() greetingText?: string | null;
  @IsOptional() @IsBoolean() awayEnabled?: boolean;
  @IsOptional() @IsString() awayText?: string | null;
  @IsOptional() @IsInt() @Min(0) autoReplyCooldownMin?: number;
}

class RuleDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() matchType?: string;
  @IsArray() @IsString({ each: true }) keywords: string[];
  @IsString() @MinLength(1) replyText: string;
  @IsOptional() @IsInt() priority?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('config')
  getConfig() {
    return this.automation.getConfig();
  }

  @Put('config')
  @UseGuards(AdminGuard)
  updateConfig(@Body() dto: ConfigDto) {
    return this.automation.updateConfig(dto);
  }

  @Get('rules')
  listRules() {
    return this.automation.listRules();
  }

  @Post('rules')
  @UseGuards(AdminGuard)
  createRule(@Body() dto: RuleDto) {
    return this.automation.createRule(dto);
  }

  @Patch('rules/:id')
  @UseGuards(AdminGuard)
  updateRule(@Param('id') id: string, @Body() dto: Partial<RuleDto>) {
    return this.automation.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @UseGuards(AdminGuard)
  deleteRule(@Param('id') id: string) {
    return this.automation.deleteRule(id);
  }
}

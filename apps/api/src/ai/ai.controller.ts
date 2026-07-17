import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AiService } from './ai.service';

class AiSettingDto {
  @IsOptional() @IsString() knowledgeBase?: string;
  @IsOptional() @IsString() tone?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return { configured: this.ai.configured };
  }

  @Get('settings')
  getSettings() {
    return this.ai.getSetting();
  }

  @Put('settings')
  @UseGuards(AdminGuard)
  updateSettings(@Body() dto: AiSettingDto) {
    return this.ai.updateSetting(dto);
  }

  @Post('conversations/:id/suggest')
  suggest(@Param('id') id: string) {
    return this.ai.suggestReply(id);
  }

  @Post('conversations/:id/summarize')
  summarize(@Param('id') id: string) {
    return this.ai.summarize(id);
  }
}

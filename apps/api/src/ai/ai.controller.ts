import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AiService } from './ai.service';

class AiSettingDto {
  @IsOptional() @IsString() knowledgeBase?: string;
  @IsOptional() @IsString() tone?: string;
}

class ChatMessageDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() content: string;
}

class ChatDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
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

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.ai.chat(dto.messages);
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

import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

class StartChatDto {
  @IsString()
  @MinLength(6)
  phone: string;

  @IsString()
  @MinLength(1)
  templateId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParams?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class StartChatController {
  constructor(private readonly messages: MessagesService) {}

  @Post('start')
  start(@Body() dto: StartChatDto, @Request() req: any) {
    return this.messages.startConversation(
      req.user.id,
      dto.phone,
      dto.templateId,
      dto.bodyParams ?? [],
    );
  }
}

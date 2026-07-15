import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  body: string;
}

@UseGuards(JwtAuthGuard)
@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  send(@Param('id') id: string, @Body() dto: SendMessageDto, @Request() req: any) {
    return this.messages.sendText(id, req.user.id, dto.body);
  }
}

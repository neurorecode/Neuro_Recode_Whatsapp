import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.conversations.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.conversations.getOrThrow(id);
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.conversations.messages(id);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.conversations.markRead(id).then(() => ({ ok: true }));
  }
}

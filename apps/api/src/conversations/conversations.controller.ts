import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

class UpdateTicketDto {
  @IsOptional()
  @IsString()
  assigneeAgentId?: string | null;

  @IsOptional()
  @IsIn(['open', 'pending', 'closed'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;
}

class AddNoteDto {
  @IsString()
  @MinLength(1)
  body: string;
}

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('assignee') assignee?: string,
    @Query('q') q?: string,
    @Request() req?: any,
  ) {
    // `assignee=me` resolves to the caller.
    const assigneeAgentId = assignee === 'me' ? req.user.id : assignee || undefined;
    return this.conversations.list({ status, assigneeAgentId, q });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.conversations.getOrThrow(id);
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.conversations.messages(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.conversations.updateTicket(id, dto);
  }

  @Get(':id/notes')
  notes(@Param('id') id: string) {
    return this.conversations.listNotes(id);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @Request() req: any) {
    return this.conversations.addNote(id, req.user.id, dto.body);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.conversations.markRead(id).then(() => ({ ok: true }));
  }
}

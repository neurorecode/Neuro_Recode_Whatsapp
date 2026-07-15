import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { StartChatController } from './start-chat.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [WhatsappModule, RealtimeModule, ConversationsModule],
  providers: [MessagesService],
  controllers: [MessagesController, StartChatController],
})
export class MessagesModule {}

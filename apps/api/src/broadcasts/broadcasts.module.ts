import { Module } from '@nestjs/common';
import { BroadcastsService } from './broadcasts.service';
import { BroadcastsController } from './broadcasts.controller';
import { BroadcastQueue } from './broadcast.queue';
import { BroadcastProcessor } from './broadcast.processor';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ContactsModule } from '../contacts/contacts.module';
import { TemplatesModule } from '../templates/templates.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [WhatsappModule, ContactsModule, TemplatesModule, RealtimeModule],
  providers: [BroadcastsService, BroadcastQueue, BroadcastProcessor],
  controllers: [BroadcastsController],
})
export class BroadcastsModule {}

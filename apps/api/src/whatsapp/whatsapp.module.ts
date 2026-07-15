import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappQueue } from './whatsapp.queue';
import { WhatsappProcessor } from './whatsapp.processor';
import { WhatsappIngestService } from './whatsapp-ingest.service';
import { WhatsappSignatureGuard } from './whatsapp-signature.guard';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsappQueue,
    WhatsappProcessor,
    WhatsappIngestService,
    WhatsappSignatureGuard,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}

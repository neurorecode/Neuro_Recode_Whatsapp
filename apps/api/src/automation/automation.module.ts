import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { BroadcastsModule } from '../broadcasts/broadcasts.module';
import { AutomationSenderService } from './automation-sender.service';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { SequencesService } from './sequences.service';
import { SequencesController } from './sequences.controller';
import { FlowsService } from './flows.service';
import { FlowsController } from './flows.controller';
import { AutomationSchedulerService } from './automation-scheduler.service';

@Module({
  imports: [PrismaModule, RealtimeModule, WhatsappModule, BroadcastsModule],
  providers: [
    AutomationSenderService,
    AutomationService,
    SequencesService,
    FlowsService,
    AutomationSchedulerService,
  ],
  controllers: [AutomationController, SequencesController, FlowsController],
})
export class AutomationModule {}

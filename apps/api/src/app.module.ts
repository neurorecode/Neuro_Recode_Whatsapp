import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ContactsModule } from './contacts/contacts.module';
import { TemplatesModule } from './templates/templates.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { AgentsModule } from './agents/agents.module';
import { CannedModule } from './canned/canned.module';
import { MediaModule } from './media/media.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AutomationModule } from './automation/automation.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MediaModule,
    RealtimeModule,
    AuthModule,
    ConversationsModule,
    MessagesModule,
    ContactsModule,
    TemplatesModule,
    BroadcastsModule,
    AgentsModule,
    CannedModule,
    WhatsappModule,
    AutomationModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

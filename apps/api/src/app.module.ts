import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { MediaModule } from './media/media.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
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
    WhatsappModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

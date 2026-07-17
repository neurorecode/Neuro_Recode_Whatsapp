import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [PrismaModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}

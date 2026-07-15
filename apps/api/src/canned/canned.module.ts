import { Module } from '@nestjs/common';
import { CannedService } from './canned.service';
import { CannedController } from './canned.controller';

@Module({
  providers: [CannedService],
  controllers: [CannedController],
})
export class CannedModule {}

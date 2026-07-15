import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';
import { MediaController } from './media.controller';
import { MediaTokenGuard } from './media-token.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get('jwt')!.secret }),
    }),
  ],
  providers: [MediaStorageService, MediaTokenGuard],
  controllers: [MediaController],
  exports: [MediaStorageService],
})
export class MediaModule {}

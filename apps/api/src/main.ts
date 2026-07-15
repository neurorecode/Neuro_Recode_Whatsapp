import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  // rawBody: true lets us verify the WhatsApp webhook signature against the
  // exact bytes Meta sent (JSON re-serialization would change the signature).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api', { exclude: ['health', 'webhooks/whatsapp'] });

  // Socket.IO scaled across processes via Redis pub/sub.
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(config.get('redis')!.url);
  app.useWebSocketAdapter(redisAdapter);

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on :${port}`);
}

bootstrap();

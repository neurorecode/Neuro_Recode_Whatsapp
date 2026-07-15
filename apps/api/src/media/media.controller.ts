import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorageService } from './media-storage.service';
import { MediaTokenGuard } from './media-token.guard';

@Controller('media')
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
  ) {}

  /** Stream a message's stored media (image/audio/video/document). */
  @UseGuards(MediaTokenGuard)
  @Get(':messageId')
  async serve(@Param('messageId') messageId: string, @Res() res: Response) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || !message.mediaKey) throw new NotFoundException('Media not found');

    res.setHeader('Content-Type', message.mediaMime ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (message.type === 'document' && message.mediaFilename) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${message.mediaFilename.replace(/"/g, '')}"`,
      );
    }

    const stream = await this.storage.getStream(message.mediaKey);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  }
}

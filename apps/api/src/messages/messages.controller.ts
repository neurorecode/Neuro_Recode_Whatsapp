import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  body: string;
}

// WhatsApp media caps vary by type (docs up to 100MB); keep a sane upload limit.
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  send(@Param('id') id: string, @Body() dto: SendMessageDto, @Request() req: any) {
    return this.messages.sendText(id, req.user.id, dto.body);
  }

  @Post('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  sendMedia(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('caption') caption: string | undefined,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.messages.sendMedia(
      id,
      req.user.id,
      { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname },
      caption,
    );
  }
}

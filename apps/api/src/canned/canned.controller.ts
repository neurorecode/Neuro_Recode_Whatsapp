import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CannedService } from './canned.service';

class CreateCannedDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;
}

@UseGuards(JwtAuthGuard)
@Controller('canned')
export class CannedController {
  constructor(private readonly canned: CannedService) {}

  @Get()
  list() {
    return this.canned.list();
  }

  @Post()
  create(@Body() dto: CreateCannedDto, @Request() req: any) {
    return this.canned.create(req.user.id, dto.title, dto.body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.canned.remove(id).then(() => ({ ok: true }));
  }
}

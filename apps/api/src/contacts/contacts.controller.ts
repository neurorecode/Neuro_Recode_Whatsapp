import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';

class UpdateContactDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['unknown', 'opted_in', 'opted_out'])
  optInStatus?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Query('tag') tag?: string, @Query('q') q?: string) {
    return this.contacts.list(tag, q);
  }

  @Get('tags')
  tags() {
    return this.contacts.tags();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto);
  }
}

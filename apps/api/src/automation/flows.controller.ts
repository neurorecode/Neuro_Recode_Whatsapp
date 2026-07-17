import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { FlowsService } from './flows.service';

class FlowDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() trigger?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsObject() graph: { nodes: any[] };
  @IsOptional() @IsString() startNodeId?: string | null;
}

@UseGuards(JwtAuthGuard)
@Controller('flows')
export class FlowsController {
  constructor(private readonly flows: FlowsService) {}

  @Get()
  list() {
    return this.flows.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.flows.get(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: FlowDto) {
    return this.flows.create(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: FlowDto) {
    return this.flows.update(id, dto);
  }

  @Patch(':id/enabled')
  @UseGuards(AdminGuard)
  setEnabled(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.flows.setEnabled(id, enabled);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.flows.remove(id);
  }
}

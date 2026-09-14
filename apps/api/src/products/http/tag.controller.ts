import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TagService } from '../application/tag.service';
import { AuthGuard } from '../../auth/http/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/v1/stores/:storeId/tags')
export class TagController {
  constructor(private readonly tags: TagService) {}

  @Get()
  async list(@Param('storeId') storeId: string) {
    return { data: await this.tags.list(storeId) };
  }

  @Post()
  async create(@Param('storeId') storeId: string, @Body() body: { name: string }) {
    return { data: await this.tags.create(storeId, body.name) };
  }

  @Delete(':id')
  async delete(@Param('storeId') storeId: string, @Param('id') id: string) {
    await this.tags.delete(id, storeId);
  }
}

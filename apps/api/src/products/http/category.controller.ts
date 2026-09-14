import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CategoryService } from '../application/category.service';
import { AuthGuard } from '../../auth/http/auth.guard';
import type { Category } from '../domain/category';

@UseGuards(AuthGuard)
@Controller('api/v1/stores/:storeId/categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  async list(@Param('storeId') storeId: string, @Query('tree') tree?: string) {
    const categories = await this.categories.list(storeId);
    if (tree !== undefined) {
      return { data: categories };
    }
    return { data: categories.flatMap((c) => this.flatten(c)) };
  }

  @Post()
  async create(@Param('storeId') storeId: string, @Body() body: { name: string; slug: string; parentId?: string | null; sortOrder?: number }) {
    return { data: await this.categories.create(storeId, body.name, body.slug, body.parentId, body.sortOrder) };
  }

  @Patch(':id')
  async update(@Param('storeId') storeId: string, @Param('id') id: string, @Body() body: Partial<Pick<Parameters<CategoryService['update']>[2], 'name' | 'slug' | 'parentId' | 'sortOrder'>>) {
    return { data: await this.categories.update(id, storeId, body) };
  }

  @Delete(':id')
  async delete(@Param('storeId') storeId: string, @Param('id') id: string) {
    await this.categories.delete(id, storeId);
  }

  private flatten(category: Category & { children?: Category[] }): Category[] {
    const { children, ...rest } = category;
    const result: Category[] = [rest];
    if (children) {
      for (const child of children) {
        result.push(...this.flatten(child));
      }
    }
    return result;
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ProductService } from '../application/product.service';
import { AuthGuard } from '../../auth/http/auth.guard';
import { PermissionGuard, RequirePermission } from '../../authorization/http/permission.guard';
import type { ProductFilters } from '../infrastructure/product.repository';

type AuthenticatedRequest = Request & { userId?: string; context?: Record<string, unknown> };

@UseGuards(AuthGuard)
@Controller('api/v1/stores/:storeId/products')
export class ProductController {
  constructor(private readonly products: ProductService) {}

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }

  @RequirePermission('products.read')
  @UseGuards(PermissionGuard)
  @Get()
  async list(@Param('storeId') storeId: string, @Query() query: ProductFilters) {
    return { data: await this.products.list(storeId, query) };
  }

  @RequirePermission('products.manage')
  @UseGuards(PermissionGuard)
  @Post()
  async create(@Param('storeId') storeId: string, @Body() body: Parameters<ProductService['create']>[0], @Req() request: AuthenticatedRequest) {
    return { data: await this.products.create({ ...body, storeId, createdBy: this.userId(request) }) };
  }

  @RequirePermission('products.read')
  @UseGuards(PermissionGuard)
  @Get(':id')
  async get(@Param('storeId') storeId: string, @Param('id') id: string) {
    return { data: await this.products.findById(id, storeId) };
  }

  @RequirePermission('products.manage')
  @UseGuards(PermissionGuard)
  @Patch(':id')
  async update(@Param('storeId') storeId: string, @Param('id') id: string, @Body() body: Parameters<ProductService['update']>[2]) {
    return { data: await this.products.update(id, storeId, body) };
  }

  @RequirePermission('products.manage')
  @UseGuards(PermissionGuard)
  @Delete(':id')
  @HttpCode(204)
  async archive(@Param('storeId') storeId: string, @Param('id') id: string) {
    await this.products.archive(id, storeId);
  }

  @RequirePermission('products.manage')
  @UseGuards(PermissionGuard)
  @Post(':id/duplicate')
  async duplicate(@Param('storeId') storeId: string, @Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return { data: await this.products.duplicate(id, storeId, this.userId(request)) };
  }
}

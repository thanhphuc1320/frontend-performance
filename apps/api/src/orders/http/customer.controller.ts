import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerService } from '../application/customer.service';
import { AuthGuard } from '../../auth/http/auth.guard';
import { PermissionGuard, RequirePermission } from '../../authorization/http/permission.guard';

type AuthenticatedRequest = Request & { userId?: string; context?: Record<string, unknown> };

@UseGuards(AuthGuard)
@Controller('api/v1/stores/:storeId/customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }

  @RequirePermission('customers.read')
  @UseGuards(PermissionGuard)
  @Get()
  async list(@Param('storeId') storeId: string, @Query('search') search?: string) {
    return { data: await this.customers.list(storeId, search) };
  }

  @RequirePermission('customers.merge')
  @UseGuards(PermissionGuard)
  @Post()
  async create(@Param('storeId') storeId: string, @Body() body: Parameters<CustomerService['create']>[0]) {
    return { data: await this.customers.create({ ...body, storeId }) };
  }

  @RequirePermission('customers.read')
  @UseGuards(PermissionGuard)
  @Get(':id')
  async get(@Param('storeId') storeId: string, @Param('id') id: string) {
    return { data: await this.customers.findById(id, storeId) };
  }

  @RequirePermission('customers.merge')
  @UseGuards(PermissionGuard)
  @Patch(':id')
  async update(@Param('storeId') storeId: string, @Param('id') id: string, @Body() body: Parameters<CustomerService['update']>[2]) {
    return { data: await this.customers.update(id, storeId, body) };
  }

  @RequirePermission('customers.merge')
  @UseGuards(PermissionGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('storeId') storeId: string, @Param('id') id: string) {
    await this.customers.delete(id, storeId);
  }
}

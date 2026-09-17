import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OrderService } from '../application/order.service';
import { AuthGuard } from '../../auth/http/auth.guard';
import { PermissionGuard, RequirePermission } from '../../authorization/http/permission.guard';
import type { OrderFilters } from '../infrastructure/order.repository';
import type { OrderStatus } from '../domain/order-status';

type AuthenticatedRequest = Request & { userId?: string; context?: Record<string, unknown> };

@UseGuards(AuthGuard)
@Controller('api/v1/stores/:storeId/orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }

  @RequirePermission('orders.read')
  @UseGuards(PermissionGuard)
  @Get()
  async list(@Param('storeId') storeId: string, @Query() query: OrderFilters) {
    return { data: await this.orders.listOrders(storeId, query) };
  }

  @RequirePermission('orders.update')
  @UseGuards(PermissionGuard)
  @Post()
  async create(@Param('storeId') storeId: string, @Body() body: Parameters<OrderService['createOrder']>[0], @Req() request: AuthenticatedRequest) {
    return { data: await this.orders.createOrder({ ...body, storeId, createdBy: this.userId(request) }) };
  }

  @RequirePermission('orders.read')
  @UseGuards(PermissionGuard)
  @Get(':id')
  async get(@Param('storeId') storeId: string, @Param('id') id: string) {
    return { data: await this.orders.findById(id, storeId) };
  }

  @RequirePermission('orders.update')
  @UseGuards(PermissionGuard)
  @Patch(':id/status')
  async updateStatus(
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { status: OrderStatus; notes?: string | null },
    @Req() request: AuthenticatedRequest,
  ) {
    return { data: await this.orders.updateStatus(id, storeId, body.status, body.notes ?? null, this.userId(request)) };
  }

  @RequirePermission('orders.update')
  @UseGuards(PermissionGuard)
  @Patch(':id')
  async update(@Param('storeId') storeId: string, @Param('id') id: string, @Body() body: Parameters<OrderService['updateOrder']>[2]) {
    return { data: await this.orders.updateOrder(id, storeId, body) };
  }

  @RequirePermission('orders.cancel')
  @UseGuards(PermissionGuard)
  @Delete(':id')
  @HttpCode(204)
  async cancel(@Param('storeId') storeId: string, @Param('id') id: string, @Body() body: { notes?: string | null }, @Req() request: AuthenticatedRequest) {
    await this.orders.cancelOrder(id, storeId, body.notes ?? null, this.userId(request));
  }
}

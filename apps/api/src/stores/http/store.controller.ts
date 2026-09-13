import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StoreService } from '../application/store.service';
import { AuthGuard } from '../../auth/http/auth.guard';
import { PermissionGuard, RequirePermission } from '../../authorization/http/permission.guard';

type AuthenticatedRequest = Request & { userId?: string; context?: Record<string, unknown> };

@UseGuards(AuthGuard)
@Controller('api/v1/stores')
export class StoreController {
  constructor(private readonly stores: StoreService) {}

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }

  private requestId(request: AuthenticatedRequest): string | undefined {
    const id = request.header('x-request-id');
    return id?.trim() || undefined;
  }

  @Post()
  // First-Store retries must send the same Idempotency-Key for the same request state.
  async create(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') idempotencyKey: string | undefined, @Body() body: { name: string; timezone?: string; currency?: string }) {
    return { data: await this.stores.createFirstStore(this.userId(request), body, idempotencyKey ?? '', this.requestId(request)) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return { data: await this.stores.listStores(this.userId(request)) };
  }

  @Post(':storeId/select')
  @HttpCode(200)
  async select(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.stores.selectStore(this.userId(request), storeId);
    res.cookie('commerce_selected_store', storeId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { data: result };
  }

  @RequirePermission('store.settings')
  @UseGuards(PermissionGuard)
  @Patch(':storeId')
  async update(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Body() body: { name?: string; timezone?: string; currency?: string }) {
    return { data: await this.stores.updateStore(this.userId(request), storeId, body, this.requestId(request)) };
  }

  @RequirePermission('store.deactivate')
  @UseGuards(PermissionGuard)
  @Post(':storeId/deactivate')
  @HttpCode(200)
  async deactivate(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string) {
    return { data: await this.stores.deactivateStore(this.userId(request), storeId, this.requestId(request)) };
  }

  @RequirePermission('store.deactivate')
  @UseGuards(PermissionGuard)
  @Post(':storeId/reactivate')
  @HttpCode(200)
  async reactivate(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string) {
    return { data: await this.stores.reactivateStore(this.userId(request), storeId, this.requestId(request)) };
  }
}

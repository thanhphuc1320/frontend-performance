import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { StoreService } from '../application/store.service';

type AuthenticatedRequest = Request & { userId?: string };

@Controller('api/v1/stores')
export class StoreController {
  constructor(private readonly stores: StoreService) {}

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') idempotencyKey: string | undefined, @Body() body: { name: string; timezone?: string; currency?: string }) {
    return { data: await this.stores.createFirstStore(this.userId(request), body, idempotencyKey ?? '') };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return { data: await this.stores.listStores(this.userId(request)) };
  }

  @Post(':storeId/select')
  @HttpCode(200)
  async select(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string) {
    return { data: await this.stores.selectStore(this.userId(request), storeId) };
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }
}

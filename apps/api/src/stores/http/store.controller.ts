import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { StoreService } from '../application/store.service';

type AuthenticatedRequest = Request & { userId?: string };

@Controller('api/v1/stores')
export class StoreController {
  constructor(private readonly stores: StoreService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: { name: string; timezone?: string; currency?: string }) {
    return this.stores.createFirstStore(this.userId(request), body);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.stores.listStores(this.userId(request));
  }

  @Post(':storeId/select')
  select(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string) {
    return this.stores.selectStore(this.userId(request), storeId);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }
}

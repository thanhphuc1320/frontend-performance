import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StoreService } from '../application/store.service';
import { AuthGuard } from '../../auth/http/auth.guard';

type AuthenticatedRequest = Request & { userId?: string };

@UseGuards(AuthGuard)
@Controller('api/v1/stores')
export class StoreController {
  constructor(private readonly stores: StoreService) {}

  @Post()
  // First-Store retries must send the same Idempotency-Key for the same request state.
  async create(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') idempotencyKey: string | undefined, @Body() body: { name: string; timezone?: string; currency?: string }) {
    return { data: await this.stores.createFirstStore(this.userId(request), body, idempotencyKey ?? '') };
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

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }
}

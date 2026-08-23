import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';

export const REQUEST_ID_PROVIDER = Symbol('REQUEST_ID_PROVIDER');
export type RequestIdProvider = (request?: Request & { requestId?: string }) => string;

@Controller('health')
export class HealthController {
  constructor(
    @Inject(REQUEST_ID_PROVIDER) private readonly requestId: RequestIdProvider,
  ) {}

  @Get()
  getHealth(@Req() request?: Request & { requestId?: string }): {
    status: 'ok';
    requestId: string;
  } {
    return { status: 'ok', requestId: this.requestId(request) };
  }
}

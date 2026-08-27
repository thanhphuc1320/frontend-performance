import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/http/auth.guard';
import type { RequestContext } from '../../auth/application/session.service';

@UseGuards(AuthGuard)
@Controller('api/v1')
export class CapabilitiesController {
  @Get('capabilities')
  async getCapabilities(@Req() request: Request & { context?: Record<string, unknown> }): Promise<{ data: { permissions: string[] } }> {
    const context = request.context as unknown as RequestContext | undefined;
    const permissions = context?.permissions ?? [];
    return { data: { permissions } };
  }
}

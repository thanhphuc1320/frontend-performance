import { Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/http/auth.guard';
import type { RequestContext } from '../../auth/application/session.service';
import { MembershipService } from '../application/membership.service';
import { InvitationService } from '../application/invitation.service';
import { ApiError } from '../../http/api-error';
import { ROLE_CODES, type RoleCode } from '../../authorization/domain/permission';

type AuthenticatedRequest = Request & { userId?: string; context?: Record<string, unknown> };

function validateRoleCode(roleCode: string): RoleCode {
  if (!ROLE_CODES.includes(roleCode as RoleCode)) {
    throw new ApiError(400, 'INVALID_ROLE_CODE', `Invalid role code: ${roleCode}`);
  }
  return roleCode as RoleCode;
}

@UseGuards(AuthGuard)
@Controller('api/v1')
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly invitationService: InvitationService,
  ) {}

  @Get('stores/:storeId/members')
  async list(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string) {
    return { data: await this.membershipService.list(this.context(request), storeId) };
  }

  @Post('stores/:storeId/members/leave')
  async leave(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string) {
    return { data: await this.membershipService.leave(this.context(request), storeId) };
  }

  @Post('stores/:storeId/members/:userId/suspend')
  async suspend(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Param('userId') userId: string) {
    return { data: await this.membershipService.suspend(this.context(request), storeId, userId) };
  }

  @Post('stores/:storeId/members/:userId/remove')
  async remove(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Param('userId') userId: string) {
    return { data: await this.membershipService.remove(this.context(request), storeId, userId) };
  }

  @Patch('stores/:storeId/members/:userId/role')
  async changeRole(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Param('userId') userId: string, @Body() body: { roleCode: string }) {
    return { data: await this.membershipService.changeRole(this.context(request), storeId, userId, validateRoleCode(body.roleCode)) };
  }

  @Post('stores/:storeId/invitations')
  async invite(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Body() body: { email: string; roleCode: string }) {
    return { data: await this.invitationService.invite(this.context(request), storeId, body.email, validateRoleCode(body.roleCode)) };
  }

  @Post('stores/:storeId/invitations/:invitationId/resend')
  async resend(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Param('invitationId') invitationId: string) {
    return { data: await this.invitationService.resend(this.context(request), storeId, invitationId) };
  }

  @Post('stores/:storeId/invitations/:invitationId/revoke')
  async revokeInvitation(@Req() request: AuthenticatedRequest, @Param('storeId') storeId: string, @Param('invitationId') invitationId: string) {
    return { data: await this.invitationService.revoke(this.context(request), storeId, invitationId) };
  }

  @Post('invitations/accept')
  async accept(@Req() request: AuthenticatedRequest, @Body() body: { token: string }) {
    if (typeof body?.token !== 'string' || !body.token.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invitation token is required');
    }
    return { data: await this.invitationService.accept(body.token, this.userId(request)) };
  }

  private context(request: AuthenticatedRequest): RequestContext {
    return (request.context ?? { userId: this.userId(request), sessionId: '' }) as unknown as RequestContext;
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.userId) throw new UnauthorizedException();
    return request.userId;
  }
}

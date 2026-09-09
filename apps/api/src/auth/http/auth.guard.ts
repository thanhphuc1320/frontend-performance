import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ApiError } from '../../http/api-error';
import { SessionService } from '../application/session.service';
import { SESSION_SERVICE } from '../application/session.tokens';
import { API_CONFIG } from '../../identity/application/identity.tokens';
import type { ApiConfig } from '@commerce/config';
import { DATABASE, PostgresDatabase } from '../../infrastructure/database.provider';
import { ROLE_PERMISSIONS, type RoleCode } from '../../authorization/domain/permission';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(SESSION_SERVICE) private readonly sessionService: SessionService,
    @Inject(API_CONFIG) private readonly config: Pick<ApiConfig, 'SESSION_COOKIE_NAME'>,
    @Inject(DATABASE) private readonly database: PostgresDatabase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; context?: Record<string, unknown> }>();
    const rawToken = request.cookies?.[this.config.SESSION_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const sessionContext = await this.sessionService.validate(rawToken);
    if (!sessionContext) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    await this.sessionService.touch(sessionContext.sessionId);

    if (this.isMutation(request.method)) {
      const csrfCookie = request.cookies?.['csrf_token'];
      const csrfHeader = request.headers['x-csrf-token'];
      if (!csrfCookie || !csrfHeader || typeof csrfCookie !== 'string' || typeof csrfHeader !== 'string') {
        throw new ApiError(403, 'CSRF_ERROR', 'CSRF token required');
      }
      if (!this.constantTimeEqual(csrfCookie, csrfHeader)) {
        throw new ApiError(403, 'CSRF_ERROR', 'Invalid CSRF token');
      }
    }

    const storeId = this.extractStoreId(request);
    const requestId = request.header('x-request-id')?.trim() || undefined;
    const requestContext: Record<string, unknown> = {
      userId: sessionContext.userId,
      sessionId: sessionContext.sessionId,
      requestId,
    };

    if (storeId) {
      const membership = await this.lookupMembership(storeId, sessionContext.userId);
      if (!membership) {
        throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
      }
      requestContext.storeId = storeId;
      requestContext.membershipStatus = membership.status;
      requestContext.role = membership.role;
      requestContext.permissions = membership.permissions;
    }

    request.userId = sessionContext.userId;
    request.context = requestContext;
    return true;
  }

  private isMutation(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private extractStoreId(request: Request): string | undefined {
    const req = request as Request & { params?: Record<string, unknown>; query?: Record<string, unknown>; cookies?: Record<string, string> };
    if (typeof req.params?.storeId === 'string') return req.params.storeId;
    if (typeof req.query?.storeId === 'string') return req.query.storeId;
    const headerStoreId = request.headers['x-store-id'];
    if (typeof headerStoreId === 'string') return headerStoreId;
    if (typeof req.cookies?.['commerce_selected_store'] === 'string') return req.cookies['commerce_selected_store'];
    return undefined;
  }

  private async lookupMembership(storeId: string, userId: string): Promise<{ status: string; role: string; permissions: string[] } | null> {
    const result = await this.database.query<{ store_status: string; membership_status: string | null; role_code: string | null }>(
      `SELECT s.status AS store_status, m.status AS membership_status, r.code AS role_code
       FROM stores s
       LEFT JOIN store_memberships m ON m.store_id = s.id AND m.user_id = $2
       LEFT JOIN roles r ON r.id = m.role_id
       WHERE s.id = $1`,
      [storeId, userId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0]!;
    if (row.membership_status !== 'ACTIVE') return null;
    if (!row.role_code) return null;
    const permissions = ROLE_PERMISSIONS[row.role_code as RoleCode] ?? [];
    return { status: row.membership_status, role: row.role_code, permissions: [...permissions] };
  }
}

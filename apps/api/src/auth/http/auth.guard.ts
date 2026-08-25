import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ApiError } from '../../http/api-error';
import { SessionService } from '../application/session.service';
import { SESSION_SERVICE } from '../application/session.tokens';
import { API_CONFIG } from '../../identity/application/identity.tokens';
import type { ApiConfig } from '@commerce/config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(SESSION_SERVICE) private readonly sessionService: SessionService,
    @Inject(API_CONFIG) private readonly config: Pick<ApiConfig, 'SESSION_COOKIE_NAME'>,
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

    request.userId = sessionContext.userId;
    request.context = sessionContext as unknown as Record<string, unknown>;
    return true;
  }

  private isMutation(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../../http/api-error';
import { SessionService } from '../application/session.service';
import { SESSION_SERVICE } from '../application/session.tokens';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(SESSION_SERVICE) private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; context?: Record<string, unknown> }>();
    const rawToken = request.cookies?.['commerce_session'];
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const user = await this.sessionService.validate(rawToken);
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    if (this.isMutation(request.method)) {
      const csrfCookie = request.cookies?.['csrf_token'];
      const csrfHeader = request.headers['x-csrf-token'];
      if (!csrfCookie || !csrfHeader || typeof csrfCookie !== 'string' || typeof csrfHeader !== 'string') {
        throw new ApiError(403, 'CSRF_ERROR', 'CSRF token required');
      }
      if (!this.sessionService.validateCsrf(rawToken, csrfHeader)) {
        throw new ApiError(403, 'CSRF_ERROR', 'Invalid CSRF token');
      }
    }

    request.userId = user.userId;
    request.context = user as unknown as Record<string, unknown>;
    return true;
  }

  private isMutation(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }
}

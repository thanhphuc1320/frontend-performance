import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthorizationService } from '../application/authorization.service';
import { ApiError } from '../../http/api-error';
import type { PermissionCode } from '../domain/permission';
import type { RequestContext } from '../../auth/application/session.service';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export function RequirePermission(permission: PermissionCode): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(REQUIRE_PERMISSION_KEY, permission, descriptor.value!);
    return descriptor;
  };
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionCode>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { context?: Record<string, unknown> }>();
    const requestContext = request.context as unknown as RequestContext | undefined;

    if (!requestContext) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const storeId = this.extractStoreId(request);

    if (!this.authorizationService.can(requestContext, requiredPermission, storeId)) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Permission denied');
    }

    return true;
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
}

import type { RequestContext } from '../../auth/application/session.service';
import type { PermissionCode } from '../domain/permission';

export class AuthorizationService {
  can(context: RequestContext, permission: PermissionCode, resourceStoreId?: string): boolean {
    if (!context.storeId || !context.membershipStatus || !context.role || !context.permissions) {
      return false;
    }

    if (context.membershipStatus !== 'ACTIVE') {
      return false;
    }

    if (resourceStoreId && resourceStoreId !== context.storeId) {
      return false;
    }

    return context.permissions.includes(permission);
  }
}

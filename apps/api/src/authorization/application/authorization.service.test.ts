import type { RequestContext } from '../../auth/application/session.service';
import { AuthorizationService } from './authorization.service';
import { ROLE_PERMISSIONS, type PermissionCode } from '../domain/permission';

describe('AuthorizationService', () => {
  function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
    return {
      userId: 'user-1',
      sessionId: 'session-1',
      storeId: 'store-1',
      membershipStatus: 'ACTIVE',
      role: 'OWNER',
      permissions: [...ROLE_PERMISSIONS.OWNER],
      ...overrides,
    };
  }

  it('grants Owner full access to all permissions', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'OWNER', permissions: [...ROLE_PERMISSIONS.OWNER] });

    for (const permission of ROLE_PERMISSIONS.OWNER) {
      expect(service.can(context, permission, 'store-1')).toBe(true);
    }
  });

  it('grants Admin operational permissions but not ownership, financial, livestream or role management', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'ADMIN', permissions: [...ROLE_PERMISSIONS.ADMIN] });

    expect(service.can(context, 'dashboard.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'orders.update' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'members.manage' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'store.settings' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'store.deactivate' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'dashboard.financial.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'dashboard.livestream.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'livestream.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'livestream.control' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'roles.read' as PermissionCode, 'store-1')).toBe(false);
  });

  it('grants Staff core operational permissions only', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'STAFF', permissions: [...ROLE_PERMISSIONS.STAFF] });

    expect(service.can(context, 'dashboard.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'orders.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'orders.update' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'products.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'customers.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'products.manage' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'inventory.adjust' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'store.settings' as PermissionCode, 'store-1')).toBe(false);
  });

  it('grants Warehouse inventory and order fulfillment permissions', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'WAREHOUSE', permissions: [...ROLE_PERMISSIONS.WAREHOUSE] });

    expect(service.can(context, 'orders.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'orders.update' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'inventory.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'inventory.adjust' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'customers.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'dashboard.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'analytics.read' as PermissionCode, 'store-1')).toBe(false);
  });

  it('grants Customer Support order and customer permissions', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'CUSTOMER_SUPPORT', permissions: [...ROLE_PERMISSIONS.CUSTOMER_SUPPORT] });

    expect(service.can(context, 'orders.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'orders.update' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'customers.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'inventory.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'products.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'dashboard.read' as PermissionCode, 'store-1')).toBe(false);
  });

  it('grants Analyst read-only dashboard and analytics permissions', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'ANALYST', permissions: [...ROLE_PERMISSIONS.ANALYST] });

    expect(service.can(context, 'dashboard.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'dashboard.financial.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'analytics.read' as PermissionCode, 'store-1')).toBe(true);
    expect(service.can(context, 'orders.read' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'orders.update' as PermissionCode, 'store-1')).toBe(false);
    expect(service.can(context, 'store.settings' as PermissionCode, 'store-1')).toBe(false);
  });

  it('denies cross-Store access even with valid permission', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'OWNER', permissions: [...ROLE_PERMISSIONS.OWNER] });

    expect(service.can(context, 'orders.read' as PermissionCode, 'store-2')).toBe(false);
  });

  it('denies access when membership is not ACTIVE', () => {
    const service = new AuthorizationService();

    for (const status of ['SUSPENDED', 'LEFT', 'REMOVED', 'INVITED']) {
      const context = makeContext({ membershipStatus: status });
      expect(service.can(context, 'orders.read' as PermissionCode, 'store-1')).toBe(false);
    }
  });

  it('denies access when request context lacks store membership', () => {
    const service = new AuthorizationService();
    const context = makeContext({ storeId: undefined, membershipStatus: undefined, role: undefined, permissions: undefined });

    expect(service.can(context, 'orders.read' as PermissionCode, 'store-1')).toBe(false);
  });

  it('denies access for unknown permission codes', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'OWNER', permissions: [...ROLE_PERMISSIONS.OWNER] });

    expect(service.can(context, 'unknown.permission' as PermissionCode, 'store-1')).toBe(false);
  });

  it('allows when resourceStoreId is omitted and context has active membership', () => {
    const service = new AuthorizationService();
    const context = makeContext({ role: 'STAFF', permissions: [...ROLE_PERMISSIONS.STAFF] });

    expect(service.can(context, 'orders.read' as PermissionCode)).toBe(true);
  });

  it('denies when resourceStoreId is omitted but context lacks membership', () => {
    const service = new AuthorizationService();
    const context = makeContext({ storeId: undefined, membershipStatus: undefined, role: undefined, permissions: undefined });

    expect(service.can(context, 'orders.read' as PermissionCode)).toBe(false);
  });
});

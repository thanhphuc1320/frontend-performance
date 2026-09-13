import { CapabilitiesController } from './capabilities.controller';
import type { RequestContext } from '../../auth/application/session.service';
import { ROLE_PERMISSIONS } from '../domain/permission';

describe('CapabilitiesController', () => {
  function makeRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
    return {
      userId: 'user-1',
      sessionId: 'session-1',
      storeId: 'store-1',
      membershipStatus: 'ACTIVE',
      role: 'ADMIN',
      permissions: [...ROLE_PERMISSIONS.ADMIN],
      ...overrides,
    };
  }

  it('returns permissions for the selected Store', async () => {
    const controller = new CapabilitiesController();
    const req = { context: makeRequestContext() as unknown as Record<string, unknown> };

    const result = await controller.getCapabilities(req as never);

    expect(result.data.permissions).toEqual([...ROLE_PERMISSIONS.ADMIN]);
  });

  it('returns empty permissions when no Store is selected', async () => {
    const controller = new CapabilitiesController();
    const req = { context: makeRequestContext({ storeId: undefined, membershipStatus: undefined, role: undefined, permissions: undefined }) as unknown as Record<string, unknown> };

    const result = await controller.getCapabilities(req as never);

    expect(result.data.permissions).toEqual([]);
  });

  it('does not expose role internals', async () => {
    const controller = new CapabilitiesController();
    const req = { context: makeRequestContext({ role: 'OWNER' }) as unknown as Record<string, unknown> };

    const result = await controller.getCapabilities(req as never);

    expect(result.data).not.toHaveProperty('role');
    expect(result.data).not.toHaveProperty('membershipStatus');
  });

  it('returns only the current Store permissions, not all Stores', async () => {
    const controller = new CapabilitiesController();
    const req = { context: makeRequestContext({ role: 'STAFF', permissions: [...ROLE_PERMISSIONS.STAFF] }) as unknown as Record<string, unknown> };

    const result = await controller.getCapabilities(req as never);

    expect(result.data.permissions).toEqual([...ROLE_PERMISSIONS.STAFF]);
    expect(result.data.permissions).not.toContain('store.settings');
  });
});

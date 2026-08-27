import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard, RequirePermission } from './permission.guard';
import { AuthorizationService } from '../application/authorization.service';
import { ROLE_PERMISSIONS } from '../domain/permission';
import type { RequestContext } from '../../auth/application/session.service';

describe('PermissionGuard', () => {
  function makeAuthorizationService() {
    return new AuthorizationService();
  }

  function makeReflector(): Reflector {
    return new Reflector();
  }

  function makeContext(options: { method?: string; params?: Record<string, string>; query?: Record<string, string>; headers?: Record<string, string>; requestContext?: Partial<RequestContext> } = {}): ExecutionContext {
    const req = {
      method: options.method ?? 'GET',
      params: options.params ?? {},
      query: options.query ?? {},
      headers: options.headers ?? {},
      context: {
        userId: 'user-1',
        sessionId: 'session-1',
        storeId: 'store-1',
        membershipStatus: 'ACTIVE',
        role: 'OWNER',
        permissions: [...ROLE_PERMISSIONS.OWNER],
        ...options.requestContext,
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => (() => undefined),
      getClass: () => class Test {},
    } as unknown as ExecutionContext;
  }

  it('allows access when permission is granted for the Store', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'orders.read', handler);
    const context = makeContext();
    const executionContext = {
      ...context,
      getHandler: () => handler,
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);
    const result = await guard.canActivate(executionContext);

    expect(result).toBe(true);
  });

  it('denies access when permission is missing', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'store.deactivate', handler);
    const context = makeContext({ requestContext: { role: 'ADMIN', permissions: [...ROLE_PERMISSIONS.ADMIN] } });
    const executionContext = {
      ...context,
      getHandler: () => handler,
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);

    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('denies cross-Store access with generic 403', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'orders.read', handler);
    const context = makeContext({ params: { storeId: 'store-2' } });
    const executionContext = {
      ...context,
      getHandler: () => handler,
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);

    await expect(guard.canActivate(executionContext)).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('allows access when no permission metadata is set', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const context = makeContext({ requestContext: { role: 'STAFF', permissions: [...ROLE_PERMISSIONS.STAFF] } });

    const guard = new PermissionGuard(reflector, authService);
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('denies access when request context is missing', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'orders.read', handler);
    const req = { method: 'GET', params: {}, query: {}, headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handler,
      getClass: () => class Test {},
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('extracts storeId from URL params when checking scope', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'orders.read', handler);
    const context = makeContext({ params: { storeId: 'store-1' } });
    const executionContext = {
      ...context,
      getHandler: () => handler,
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);
    const result = await guard.canActivate(executionContext);

    expect(result).toBe(true);
  });

  it('extracts storeId from query when checking scope', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'orders.read', handler);
    const context = makeContext({ query: { storeId: 'store-1' } });
    const executionContext = {
      ...context,
      getHandler: () => handler,
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);
    const result = await guard.canActivate(executionContext);

    expect(result).toBe(true);
  });

  it('extracts storeId from x-store-id header when checking scope', async () => {
    const authService = makeAuthorizationService();
    const reflector = makeReflector();
    const handler = () => undefined;
    Reflect.defineMetadata('require_permission', 'orders.read', handler);
    const context = makeContext({ headers: { 'x-store-id': 'store-1' } });
    const executionContext = {
      ...context,
      getHandler: () => handler,
    } as unknown as ExecutionContext;

    const guard = new PermissionGuard(reflector, authService);
    const result = await guard.canActivate(executionContext);

    expect(result).toBe(true);
  });
});

describe('RequirePermission decorator', () => {
  it('attaches permission metadata to the handler', () => {
    const handler = () => undefined;
    RequirePermission('orders.read')(handler, 'method', Object.getOwnPropertyDescriptor({ method: handler }, 'method')!);

    const metadata = Reflect.getMetadata('require_permission', handler);
    expect(metadata).toBe('orders.read');
  });
});

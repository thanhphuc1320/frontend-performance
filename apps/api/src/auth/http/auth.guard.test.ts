import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ROLE_PERMISSIONS } from '../../authorization/domain/permission';

describe('AuthGuard', () => {
  const config = { SESSION_COOKIE_NAME: 'commerce_session' };

  function makeContext(options: { method?: string; cookies?: Record<string, string>; headers?: Record<string, string>; params?: Record<string, string>; query?: Record<string, string> } = {}): ExecutionContext {
    const req = {
      method: options.method ?? 'GET',
      cookies: options.cookies ?? {},
      headers: options.headers ?? {},
      params: options.params ?? {},
      query: options.query ?? {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  function makeSessionService() {
    return {
      validate: jest.fn(async () => null as { userId: string; sessionId: string } | null),
      touch: jest.fn(async () => true),
    };
  }

  function makeDatabase(rows: Record<string, unknown>[] = []) {
    return {
      query: jest.fn(async () => ({ rows, rowCount: rows.length })),
    };
  }

  it('allows safe methods without CSRF check', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' } });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.touch).toHaveBeenCalledWith('session-1');
  });

  it('requires CSRF token for mutation methods', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'POST', cookies: { commerce_session: 'token', csrf_token: 'csrf' }, headers: { 'x-csrf-token': 'csrf' } });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.touch).toHaveBeenCalledWith('session-1');
  });

  it('rejects mutation without CSRF token', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'POST', cookies: { commerce_session: 'token' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'CSRF_ERROR' });
  });

  it('rejects invalid CSRF token by comparing cookie to header', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'POST', cookies: { commerce_session: 'token', csrf_token: 'bad-csrf' }, headers: { 'x-csrf-token': 'good-csrf' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'CSRF_ERROR' });
  });

  it('rejects invalid session', async () => {
    const service = makeSessionService();
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'bad-token' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('rejects missing session cookie', async () => {
    const service = makeSessionService();
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'GET' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('sets userId and context on the request', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.userId).toBe('user-1');
    expect(req.context.userId).toBe('user-1');
    expect(req.context.sessionId).toBe('session-1');
  });

  it('uses configurable session cookie name', async () => {
    const customConfig = { SESSION_COOKIE_NAME: 'custom_session' };
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, customConfig as never, makeDatabase() as never);

    const context = makeContext({ method: 'GET', cookies: { custom_session: 'token' } });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.validate).toHaveBeenCalledWith('token');
  });

  it('populates full RequestContext when storeId is in params and user has active membership', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'ACTIVE', role_code: 'ADMIN' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, params: { storeId: 'store-1' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.storeId).toBe('store-1');
    expect(req.context.membershipStatus).toBe('ACTIVE');
    expect(req.context.role).toBe('ADMIN');
    expect(req.context.permissions).toEqual([...ROLE_PERMISSIONS.ADMIN]);
  });

  it('populates Owner permissions for Owner membership', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'ACTIVE', role_code: 'OWNER' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, params: { storeId: 'store-1' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.role).toBe('OWNER');
    expect(req.context.permissions).toEqual([...ROLE_PERMISSIONS.OWNER]);
  });

  it('rejects when store is deactivated', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'DEACTIVATED', membership_status: 'ACTIVE', role_code: 'OWNER' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, params: { storeId: 'store-1' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('rejects when store does not exist', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, params: { storeId: 'store-1' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('rejects when membership is suspended', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'SUSPENDED', role_code: 'STAFF' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, params: { storeId: 'store-1' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('rejects when membership is missing', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: null, role_code: null }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, params: { storeId: 'store-1' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('populates minimal context when no storeId is present', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never, makeDatabase() as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.userId).toBe('user-1');
    expect(req.context.sessionId).toBe('session-1');
    expect(req.context.storeId).toBeUndefined();
    expect(req.context.permissions).toBeUndefined();
  });

  it('derives storeId from query parameter', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'ACTIVE', role_code: 'STAFF' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, query: { storeId: 'store-1' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.storeId).toBe('store-1');
    expect(req.context.role).toBe('STAFF');
  });

  it('derives storeId from x-store-id header', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'ACTIVE', role_code: 'WAREHOUSE' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' }, headers: { 'x-store-id': 'store-1' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.storeId).toBe('store-1');
    expect(req.context.role).toBe('WAREHOUSE');
  });

  it('derives storeId from commerce_selected_store cookie', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'ACTIVE', role_code: 'CUSTOMER_SUPPORT' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token', commerce_selected_store: 'store-1' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.storeId).toBe('store-1');
    expect(req.context.role).toBe('CUSTOMER_SUPPORT');
  });

  it('prefers URL params over cookie for storeId', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const db = makeDatabase([{ store_status: 'ACTIVE', membership_status: 'ACTIVE', role_code: 'ANALYST' }]);
    const guard = new AuthGuard(service as never, config as never, db as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token', commerce_selected_store: 'store-cookie' }, params: { storeId: 'store-param' } });
    await guard.canActivate(context);
    const req = context.switchToHttp().getRequest();

    expect(req.context.storeId).toBe('store-param');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE s.id = $1'), ['store-param', 'user-1']);
  });
});

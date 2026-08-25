import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const config = { SESSION_COOKIE_NAME: 'commerce_session' };

  function makeContext(options: { method?: string; cookies?: Record<string, string>; headers?: Record<string, string> } = {}): ExecutionContext {
    const req = {
      method: options.method ?? 'GET',
      cookies: options.cookies ?? {},
      headers: options.headers ?? {},
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

  it('allows safe methods without CSRF check', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'token' } });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.touch).toHaveBeenCalledWith('session-1');
  });

  it('requires CSRF token for mutation methods', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never);

    const context = makeContext({ method: 'POST', cookies: { commerce_session: 'token', csrf_token: 'csrf' }, headers: { 'x-csrf-token': 'csrf' } });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.touch).toHaveBeenCalledWith('session-1');
  });

  it('rejects mutation without CSRF token', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never);

    const context = makeContext({ method: 'POST', cookies: { commerce_session: 'token' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'CSRF_ERROR' });
  });

  it('rejects invalid CSRF token by comparing cookie to header', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never);

    const context = makeContext({ method: 'POST', cookies: { commerce_session: 'token', csrf_token: 'bad-csrf' }, headers: { 'x-csrf-token': 'good-csrf' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403, code: 'CSRF_ERROR' });
  });

  it('rejects invalid session', async () => {
    const service = makeSessionService();
    const guard = new AuthGuard(service as never, config as never);

    const context = makeContext({ method: 'GET', cookies: { commerce_session: 'bad-token' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('rejects missing session cookie', async () => {
    const service = makeSessionService();
    const guard = new AuthGuard(service as never, config as never);

    const context = makeContext({ method: 'GET' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('sets userId and context on the request', async () => {
    const service = makeSessionService();
    service.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const guard = new AuthGuard(service as never, config as never);

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
    const guard = new AuthGuard(service as never, customConfig as never);

    const context = makeContext({ method: 'GET', cookies: { custom_session: 'token' } });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(service.validate).toHaveBeenCalledWith('token');
  });
});

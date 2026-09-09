import { AuthController } from './auth.controller';

describe('AuthController', () => {
  function makeDependencies() {
    const sessions: { id: string; userId: string; sessionHash: string; rawToken: string; csrfToken: string }[] = [];
    const sessionService = {
      create: jest.fn(async (userId: string) => {
        const session = { id: 'session-1', userId, sessionHash: 'hash', rawToken: 'raw-token', csrfToken: 'csrf-token' };
        sessions.push(session);
        return session;
      }),
      validate: jest.fn(async () => null as unknown as { userId: string; sessionId: string } | null),
      touch: jest.fn(async () => true),
      revoke: jest.fn(async () => true),
      revokeAllForUser: jest.fn(async () => undefined),
      generateCsrf: jest.fn(() => 'csrf-token'),
      validateCsrf: jest.fn(() => true),
    };
    const identityService = {
      register: jest.fn(async () => ({ accepted: true })),
      verifyEmail: jest.fn(async () => ({ verified: true })),
    };
    const recoveryService = {
      requestPasswordReset: jest.fn(async () => ({ accepted: true })),
      resetPassword: jest.fn(async () => ({ accepted: true })),
      requestEmailChange: jest.fn(async () => ({ accepted: true })),
      verifyEmailChange: jest.fn(async () => ({ accepted: true })),
    };
    const passwordHasher = {
      hash: jest.fn(async (pwd: string) => `hashed:${pwd}`),
      verify: jest.fn(async () => false),
    };
    const identityRepository = {
      findUserByEmail: jest.fn(async () => null as unknown as { id: string; email: string; passwordHash: string; status: string; isLocked(): boolean; failedLoginAttempts: number; recordSuccessfulLogin(): void; recordFailedLogin(n: number): void; lockTemporarily(): void } | null),
      findUserById: jest.fn(async () => null),
      updateUser: jest.fn(async () => undefined),
      transaction: jest.fn(async <T>(work: (tx: unknown) => Promise<T>) => work(undefined)),
    };
    const config = {
      SESSION_COOKIE_NAME: 'commerce_session',
      AUTH_LOCKOUT_MAX_ATTEMPTS: 5,
      AUTH_LOCKOUT_DURATION_SECONDS: 900,
    };
    return { sessionService, identityService, recoveryService, passwordHasher, identityRepository, config, sessions };
  }

  function mockResponse() {
    return { cookie: jest.fn(), clearCookie: jest.fn() };
  }

  function mockRequest(overrides: Record<string, unknown> = {}) {
    return { header: jest.fn(() => undefined), ...overrides };
  }

  function makeController(deps: ReturnType<typeof makeDependencies>) {
    return new AuthController(deps.identityService as never, deps.sessionService as never, deps.recoveryService as never, deps.passwordHasher as never, deps.identityRepository as never, deps.config as never);
  }

  it('returns generic 401 for invalid credentials', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps);

    await expect(controller.login({ email: 'unknown@example.com', password: 'wrong' }, mockRequest() as never, mockResponse() as never)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('returns 429 after 5 failed attempts', async () => {
    const deps = makeDependencies();
    const user = { id: 'user-1', email: 'alice@example.com', passwordHash: 'hashed:password', status: 'ACTIVE', isLocked: () => true, failedLoginAttempts: 5, lockTemporarily: jest.fn(), recordFailedLogin: jest.fn(), recordSuccessfulLogin: jest.fn() };
    deps.identityRepository.findUserByEmail.mockResolvedValue(user);
    deps.passwordHasher.verify.mockResolvedValue(false);
    const controller = makeController(deps);

    await expect(controller.login({ email: 'alice@example.com', password: 'wrong' }, mockRequest() as never, mockResponse() as never)).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
  });

  it('returns a secure cookie and CSRF token on valid login', async () => {
    const deps = makeDependencies();
    const user = { id: 'user-1', email: 'alice@example.com', passwordHash: 'hashed:password', status: 'ACTIVE', isLocked: () => false, failedLoginAttempts: 0, recordSuccessfulLogin: jest.fn(), recordFailedLogin: jest.fn(), lockTemporarily: jest.fn() };
    deps.identityRepository.findUserByEmail.mockResolvedValue(user);
    deps.passwordHasher.verify.mockResolvedValue(true);
    const controller = makeController(deps);
    const res = mockResponse();

    const result = await controller.login({ email: 'alice@example.com', password: 'password' }, mockRequest() as never, res as never);

    expect(result.data.userId).toBe('user-1');
    expect(deps.sessionService.create).toHaveBeenCalledWith('user-1', expect.anything());
    expect(deps.identityRepository.updateUser).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith('commerce_session', 'raw-token', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    expect(res.cookie).toHaveBeenCalledWith('csrf_token', 'csrf-token', expect.objectContaining({ httpOnly: false, sameSite: 'lax', path: '/' }));
  });

  it('revokes the current session and clears cookies on logout', async () => {
    const deps = makeDependencies();
    deps.sessionService.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const controller = makeController(deps);
    const res = mockResponse();
    const req = { cookies: { commerce_session: 'raw-token' }, header: jest.fn(() => undefined) };

    const result = await controller.logout(req as never, res as never);

    expect(result).toEqual({ data: { accepted: true } });
    expect(deps.sessionService.revoke).toHaveBeenCalledWith('session-1', undefined);
    expect(deps.sessionService.revokeAllForUser).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('commerce_session', expect.anything());
    expect(res.clearCookie).toHaveBeenCalledWith('csrf_token', expect.anything());
  });

  it('reads session from cookie on GET /session', async () => {
    const deps = makeDependencies();
    deps.sessionService.validate.mockResolvedValueOnce({ userId: 'user-1', sessionId: 'session-1' });
    const controller = makeController(deps);
    const req = { cookies: { commerce_session: 'raw-token' } };

    const result = await controller.session(req as never);

    expect(result).toEqual({ data: { userId: 'user-1' } });
    expect(deps.sessionService.validate).toHaveBeenCalledWith('raw-token');
  });

  it('returns empty session when cookie is missing', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps);
    const req = { cookies: {} };

    const result = await controller.session(req as never);

    expect(result).toEqual({ data: {} });
    expect(deps.sessionService.validate).not.toHaveBeenCalled();
  });

  it('returns generic public response for password reset request', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps);

    const result = await controller.requestPasswordReset({ email: 'any@example.com' }, mockRequest() as never);

    expect(result).toEqual({ data: { accepted: true } });
  });

  it('returns generic public response for email change request', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps);

    const result = await controller.requestEmailChange({ newEmail: 'new@example.com' }, { userId: 'user-1', header: jest.fn(() => undefined) } as never);

    expect(result).toEqual({ data: { accepted: true } });
    expect(deps.recoveryService.requestEmailChange).toHaveBeenCalledWith({ userId: 'user-1', newEmail: 'new@example.com' }, undefined);
  });
});

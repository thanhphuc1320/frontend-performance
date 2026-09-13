import { AuditService } from './audit.service';

describe('AuditService', () => {
  function makeRepository() {
    return {
      insert: jest.fn(async (record: unknown) => ({ id: 'audit-1', ...record as Record<string, unknown> })),
    };
  }

  it('logs a safe audit record', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'user.register',
      resourceType: 'user',
      resourceId: 'user-1',
      requestId: 'req-1',
      afterData: { email: 'test@example.com', status: 'ACTIVE' },
    });

    expect(repository.insert).toHaveBeenCalledTimes(1);
    const call = repository.insert.mock.calls[0]![0] as { actorUserId: string; action: string; afterData: Record<string, unknown> };
    expect(call.actorUserId).toBe('user-1');
    expect(call.action).toBe('user.register');
    expect(call.afterData.email).toBe('test@example.com');
  });

  it('redacts password fields from audit data', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'password.reset.complete',
      resourceType: 'user',
      afterData: { password: 'secret123', passwordHash: 'abc', newPassword: 'xyz' },
    });

    const call = repository.insert.mock.calls[0]![0] as { afterData: Record<string, unknown> };
    expect(call.afterData.password).toBe('[REDACTED]');
    expect(call.afterData.passwordHash).toBe('[REDACTED]');
    expect(call.afterData.newPassword).toBe('[REDACTED]');
  });

  it('redacts token and session fields from audit data', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'session.login',
      resourceType: 'session',
      afterData: { rawToken: 'abc', csrfToken: 'def', sessionId: 'sess-1', cookie: 'secret' },
    });

    const call = repository.insert.mock.calls[0]![0] as { afterData: Record<string, unknown> };
    expect(call.afterData.rawToken).toBe('[REDACTED]');
    expect(call.afterData.csrfToken).toBe('[REDACTED]');
    expect(call.afterData.sessionId).toBe('sess-1');
    expect(call.afterData.cookie).toBe('[REDACTED]');
  });

  it('redacts secret fields from audit data', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'store.settings',
      resourceType: 'store',
      afterData: { apiSecret: 'shh', secretKey: 'key' },
    });

    const call = repository.insert.mock.calls[0]![0] as { afterData: Record<string, unknown> };
    expect(call.afterData.apiSecret).toBe('[REDACTED]');
    expect(call.afterData.secretKey).toBe('[REDACTED]');
  });

  it('does not redact safe fields', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'store.create',
      resourceType: 'store',
      afterData: { name: 'My Store', timezone: 'UTC', currency: 'VND' },
    });

    const call = repository.insert.mock.calls[0]![0] as { afterData: Record<string, unknown> };
    expect(call.afterData.name).toBe('My Store');
    expect(call.afterData.timezone).toBe('UTC');
    expect(call.afterData.currency).toBe('VND');
  });

  it('recursively redacts nested objects', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'user.register',
      resourceType: 'user',
      afterData: {
        profile: { name: 'Alice', password: 'secret' },
        metadata: { apiSecret: 'shh' },
      },
    });

    const call = repository.insert.mock.calls[0]![0] as { afterData: Record<string, unknown> };
    const profile = call.afterData.profile as Record<string, unknown>;
    expect(profile.name).toBe('Alice');
    expect(profile.password).toBe('[REDACTED]');
    const metadata = call.afterData.metadata as Record<string, unknown>;
    expect(metadata.apiSecret).toBe('[REDACTED]');
  });

  it('recursively redacts arrays', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'batch.update',
      resourceType: 'user',
      afterData: {
        items: [
          { name: 'Alice', password: 'secret1' },
          { name: 'Bob', password: 'secret2' },
        ],
      },
    });

    const call = repository.insert.mock.calls[0]![0] as { afterData: Record<string, unknown> };
    const items = call.afterData.items as Array<Record<string, unknown>>;
    expect(items[0]!.name).toBe('Alice');
    expect(items[0]!.password).toBe('[REDACTED]');
    expect(items[1]!.name).toBe('Bob');
    expect(items[1]!.password).toBe('[REDACTED]');
  });

  it('allows beforeData and afterData to be omitted', async () => {
    const repository = makeRepository();
    const service = new AuditService(repository);

    await service.log({
      actorUserId: 'user-1',
      action: 'session.logout',
      resourceType: 'session',
      resourceId: 'sess-1',
    });

    const call = repository.insert.mock.calls[0]![0] as { beforeData?: unknown; afterData?: unknown };
    expect(call.beforeData).toBeUndefined();
    expect(call.afterData).toBeUndefined();
  });
});

import { createHash } from 'node:crypto';
import { SessionService } from './session.service';
import type { SessionRecord } from '../infrastructure/session.repository';

type TestSessionRepository = {
  create: jest.Mock;
  findByHash: jest.Mock;
  touch: jest.Mock;
  revoke: jest.Mock;
  revokeAllForUser: jest.Mock;
};

function makeSessionRepository(): TestSessionRepository {
  const sessions = new Map<string, SessionRecord>();
  return {
    create: jest.fn(async (input: Omit<SessionRecord, 'revokedAt'> & { userAgent?: string; ipAddress?: string }) => {
      const record: SessionRecord = { ...input, revokedAt: null };
      sessions.set(input.id, record);
      return record;
    }),
    findByHash: jest.fn(async (hash: string) => {
      for (const session of sessions.values()) {
        if (session.sessionHash === hash && !session.revokedAt && session.idleExpiresAt > new Date() && session.absoluteExpiresAt > new Date()) {
          return session;
        }
      }
      return null;
    }),
    touch: jest.fn(async (id: string, idleExpiresAt: Date) => {
      const session = sessions.get(id);
      if (!session || session.revokedAt || session.absoluteExpiresAt <= new Date()) return false;
      session.lastActivityAt = new Date();
      session.idleExpiresAt = idleExpiresAt;
      return true;
    }),
    revoke: jest.fn(async (id: string) => {
      const session = sessions.get(id);
      if (!session || session.revokedAt) return false;
      session.revokedAt = new Date();
      return true;
    }),
    revokeAllForUser: jest.fn(async (userId: string) => {
      for (const session of sessions.values()) {
        if (session.userId === userId && !session.revokedAt) {
          session.revokedAt = new Date();
        }
      }
    }),
  };
}

function makeIdentityRepository() {
  return {
    findUserById: jest.fn(async () => null as unknown as { id: string; status: string; isLocked(): boolean } | null),
    updateUser: jest.fn(async () => undefined),
  };
}

function makeConfig() {
  return {
    SESSION_COOKIE_NAME: 'commerce_session',
    AUTH_LOCKOUT_MAX_ATTEMPTS: 5,
    AUTH_LOCKOUT_DURATION_SECONDS: 900,
    CSRF_SECRET: 'test-csrf-secret-32-bytes-long!',
  };
}

function makeService(repo: TestSessionRepository, identity: ReturnType<typeof makeIdentityRepository>) {
  return new SessionService(repo as unknown as import('../infrastructure/session.repository').SessionRepository, identity as never, makeConfig() as never);
}

describe('SessionService', () => {
  it('creates a session with hashed token, 24h idle and 30d absolute expiry', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const result = await service.create('user-1');

    expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/i);
    const expectedHash = createHash('sha256').update(result.rawToken).digest('hex');
    expect(result.sessionHash).toBe(expectedHash);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionHash: expectedHash,
      }),
    );
    const created = repo.create.mock.calls[0]![0] as SessionRecord;
    const idleHours = (created.idleExpiresAt.getTime() - created.lastActivityAt.getTime()) / (1000 * 60 * 60);
    const absoluteDays = (created.absoluteExpiresAt.getTime() - created.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(idleHours).toBeCloseTo(24, 0);
    expect(absoluteDays).toBeCloseTo(30, 0);
  });

  it('validates a live session and returns a request context with userId and sessionId', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken, sessionId } = await service.create('user-1');
    identity.findUserById.mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE', isLocked: () => false });

    const context = await service.validate(rawToken);

    expect(context).not.toBeNull();
    expect(context?.userId).toBe('user-1');
    expect(context?.sessionId).toBe(sessionId);
  });

  it('rejects an expired session', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken } = await service.create('user-1');
    const session = await repo.findByHash(createHash('sha256').update(rawToken).digest('hex'));
    if (session) {
      session.idleExpiresAt = new Date(Date.now() - 1000);
    }

    const context = await service.validate(rawToken);
    expect(context).toBeNull();
  });

  it('rejects a revoked session', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken, sessionId } = await service.create('user-1');
    await service.revoke(sessionId);

    const context = await service.validate(rawToken);
    expect(context).toBeNull();
  });

  it('touches activity and extends idle timeout up to absolute limit', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken, sessionId } = await service.create('user-1');
    const before = await repo.findByHash(createHash('sha256').update(rawToken).digest('hex'));
    const beforeTime = before!.lastActivityAt.getTime();
    await new Promise((r) => setTimeout(r, 10));
    const touched = await service.touch(sessionId);

    expect(touched).toBe(true);
    const after = await repo.findByHash(createHash('sha256').update(rawToken).digest('hex'));
    expect(after!.lastActivityAt.getTime()).toBeGreaterThan(beforeTime);
  });

  it('revokes a session on logout', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { sessionId } = await service.create('user-1');
    const revoked = await service.revoke(sessionId);

    expect(revoked).toBe(true);
    expect(repo.revoke).toHaveBeenCalledWith(sessionId);
  });

  it('revokes all sessions for a user', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    await service.create('user-1');
    await service.create('user-1');
    await service.revokeAllForUser('user-1');

    expect(repo.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('does not validate a session for a non-existent user', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken } = await service.create('user-1');
    identity.findUserById.mockResolvedValueOnce(null);

    const context = await service.validate(rawToken);
    expect(context).toBeNull();
  });

  it('does not validate a session for a locked user', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken } = await service.create('user-1');
    identity.findUserById.mockResolvedValueOnce({ id: 'user-1', status: 'TEMPORARILY_LOCKED', isLocked: () => true });

    const context = await service.validate(rawToken);
    expect(context).toBeNull();
  });

  it('does not validate a session for a disabled user', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const { rawToken } = await service.create('user-1');
    identity.findUserById.mockResolvedValueOnce({ id: 'user-1', status: 'DISABLED', isLocked: () => false });

    const context = await service.validate(rawToken);
    expect(context).toBeNull();
  });

  it('generates a CSRF token bound to the session', async () => {
    const repo = makeSessionRepository();
    const identity = makeIdentityRepository();
    const service = makeService(repo, identity);

    const result = await service.create('user-1');

    expect(result.csrfToken).toBeDefined();
    expect(result.csrfToken.length).toBeGreaterThan(0);
    expect(service.validateCsrf(result.rawToken, result.csrfToken)).toBe(true);
    expect(service.validateCsrf(result.rawToken, 'wrong-token')).toBe(false);
  });
});

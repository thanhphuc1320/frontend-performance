import { AuthTokenType } from '../domain/auth-token';
import { User } from '../domain/user';
import { RecoveryService } from './recovery.service';

describe('RecoveryService', () => {
  function makeDependencies() {
    const users = new Map<string, User>();
    const tokens = new Map<string, { userId: string; type: AuthTokenType; expiresAt: Date; email?: string }>();
    const repository = {
      transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(repository),
      createUser: jest.fn(async () => User.active('user-1', 'test@example.com', 'hash')),
      findUserByEmail: jest.fn(async (email: string) => [...users.values()].find((user) => user.email === email) ?? null),
      findUserById: jest.fn(async (id: string) => users.get(id) ?? null),
      updateUser: jest.fn(async (user: User) => { users.set(user.id, user); }),
      updateEmail: jest.fn(async (userId: string, email: string) => {
        const user = users.get(userId);
        if (user) {
          users.set(userId, new User(user.id, email, user.passwordHash, user.status, user.lockUntil ?? undefined, user.failedLoginAttempts));
        }
      }),
      createToken: jest.fn(async (input: { id: string; userId: string; type: AuthTokenType; hash: string; expiresAt: Date; email?: string }) => {
        tokens.set(input.hash, { userId: input.userId, type: input.type, expiresAt: input.expiresAt, email: input.email });
        return input;
      }),
      findToken: jest.fn(async (hash: string, type: AuthTokenType) => {
        const token = tokens.get(hash);
        return token?.type === type && token.expiresAt > new Date() ? { type, hash, userId: token.userId, expiresAt: token.expiresAt, email: token.email } : null;
      }),
      consumeToken: jest.fn(async (hash: string) => tokens.delete(hash)),
      revokeTokens: jest.fn(async () => undefined),
    };
    const email = { sendPasswordReset: jest.fn(async () => undefined), sendEmailChange: jest.fn(async () => undefined) };
    const hasher = { hash: jest.fn(async (value: string) => `hashed:${value}`), verify: jest.fn(async () => false) };
    const sessionRevoker = { revokeAllForUser: jest.fn(async () => undefined) };
    const compromisedChecker = { isCompromised: jest.fn(async () => false) };
    const config = {
      AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: 3600,
      AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: 3600,
    };
    return { repository, email, hasher, sessionRevoker, compromisedChecker, config, users, tokens };
  }

  it('requests password reset with generic response and sends hashed token email', async () => {
    const deps = makeDependencies();
    const user = User.active('user-1', 'alice@example.com', 'hash');
    deps.users.set(user.id, user);
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);

    const result = await service.requestPasswordReset({ email: 'alice@example.com' });

    expect(result).toEqual({ accepted: true });
    expect(deps.email.sendPasswordReset).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'alice@example.com' }));
    const calls = deps.email.sendPasswordReset.mock.calls as unknown[][];
    const actionUrl = (calls[0]?.[0] as { actionUrl: string }).actionUrl;
    expect(actionUrl).toContain('token=');
    expect(JSON.stringify(result)).not.toContain('token');
  });

  it('returns generic response for non-existent email', async () => {
    const deps = makeDependencies();
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);

    const result = await service.requestPasswordReset({ email: 'unknown@example.com' });

    expect(result).toEqual({ accepted: true });
    expect(deps.email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('resets password with valid token, hashes new password, and revokes sessions', async () => {
    const deps = makeDependencies();
    const user = User.active('user-1', 'alice@example.com', 'hash');
    deps.users.set(user.id, user);
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);
    await service.requestPasswordReset({ email: 'alice@example.com' });
    const calls = deps.email.sendPasswordReset.mock.calls as unknown[][];
    const actionUrl = (calls[0]?.[0] as { actionUrl: string }).actionUrl;
    const rawToken = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;

    const result = await service.resetPassword(rawToken, 'NewSecure1!');

    expect(result).toEqual({ accepted: true });
    expect(deps.hasher.hash).toHaveBeenCalledWith('NewSecure1!');
    expect(deps.sessionRevoker.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(deps.repository.consumeToken).toHaveBeenCalled();
  });

  it('rejects compromised passwords during reset', async () => {
    const deps = makeDependencies();
    const user = User.active('user-1', 'alice@example.com', 'hash');
    deps.users.set(user.id, user);
    deps.compromisedChecker.isCompromised.mockResolvedValue(true);
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);
    await service.requestPasswordReset({ email: 'alice@example.com' });
    const calls = deps.email.sendPasswordReset.mock.calls as unknown[][];
    const actionUrl = (calls[0]?.[0] as { actionUrl: string }).actionUrl;
    const rawToken = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;

    await expect(service.resetPassword(rawToken, 'compromised-p@ss1')).rejects.toThrow('Invalid password');
    expect(deps.hasher.hash).not.toHaveBeenCalled();
  });

  it('rejects invalid and expired password reset tokens', async () => {
    const deps = makeDependencies();
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);

    await expect(service.resetPassword('invalid', 'NewPass1!')).resolves.toEqual({ accepted: false });
    deps.repository.findToken.mockResolvedValueOnce(null);
    await expect(service.resetPassword('expired', 'NewPass1!')).resolves.toEqual({ accepted: false });
  });

  it('requests email change with generic response and sends hashed token email', async () => {
    const deps = makeDependencies();
    const user = User.active('user-1', 'alice@example.com', 'hash');
    deps.users.set(user.id, user);
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);

    const result = await service.requestEmailChange({ userId: 'user-1', newEmail: 'new@example.com' });

    expect(result).toEqual({ accepted: true });
    expect(deps.email.sendEmailChange).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'new@example.com' }));
  });

  it('rejects email change for non-existent user', async () => {
    const deps = makeDependencies();
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);

    const result = await service.requestEmailChange({ userId: 'unknown', newEmail: 'new@example.com' });

    expect(result).toEqual({ accepted: true });
    expect(deps.email.sendEmailChange).not.toHaveBeenCalled();
  });

  it('verifies email change with valid token and updates email transactionally', async () => {
    const deps = makeDependencies();
    const user = User.active('user-1', 'alice@example.com', 'hash');
    deps.users.set(user.id, user);
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);
    await service.requestEmailChange({ userId: 'user-1', newEmail: 'new@example.com' });
    const calls = deps.email.sendEmailChange.mock.calls as unknown[][];
    const actionUrl = (calls[0]?.[0] as { actionUrl: string }).actionUrl;
    const rawToken = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;

    const result = await service.verifyEmailChange(rawToken);

    expect(result).toEqual({ accepted: true });
    expect(deps.sessionRevoker.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(deps.repository.consumeToken).toHaveBeenCalled();
    expect(deps.repository.updateEmail).toHaveBeenCalledWith('user-1', 'new@example.com', expect.anything());
    expect(deps.users.get('user-1')?.email).toBe('new@example.com');
  });

  it('rejects email change when new email already exists', async () => {
    const deps = makeDependencies();
    const user1 = User.active('user-1', 'alice@example.com', 'hash');
    const user2 = User.active('user-2', 'existing@example.com', 'hash');
    deps.users.set(user1.id, user1);
    deps.users.set(user2.id, user2);
    const service = new RecoveryService(deps.repository, deps.hasher, deps.email, deps.sessionRevoker as never, deps.compromisedChecker as never, deps.config as never);

    const result = await service.requestEmailChange({ userId: 'user-1', newEmail: 'existing@example.com' });

    expect(result).toEqual({ accepted: true });
    expect(deps.email.sendEmailChange).not.toHaveBeenCalled();
  });
});

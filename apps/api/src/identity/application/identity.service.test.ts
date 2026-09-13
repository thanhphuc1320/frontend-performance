import { AuthTokenType } from '../domain/auth-token';
import { User, UserStatus } from '../domain/user';
import { IdentityService } from './identity.service';

function makeDependencies() {
  const users = new Map<string, User>();
  const tokens = new Map<string, { userId: string; type: AuthTokenType; expiresAt: Date }>();
  type TestRepository = {
    transaction: <T>(work: (tx: unknown) => Promise<T>) => Promise<T>;
    createUser: jest.Mock;
    findUserByEmail: jest.Mock;
    findUserById: jest.Mock;
    updateUser: jest.Mock;
    updateEmail: jest.Mock;
    createToken: jest.Mock;
    findToken: jest.Mock;
    consumeToken: jest.Mock;
  };
  const repository: TestRepository = {
    transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(repository),
    createUser: jest.fn(async (input: { id: string; email: string; passwordHash: string }) => {
      const user = new User(input.id, input.email, input.passwordHash);
      users.set(user.id, user);
      return user;
    }),
    findUserByEmail: jest.fn(async (email: string) => [...users.values()].find((user) => user.email === email) ?? null),
    findUserById: jest.fn(async (id: string) => users.get(id) ?? null),
    updateUser: jest.fn(async (user: User) => users.set(user.id, user)),
    updateEmail: jest.fn(async () => undefined),
    createToken: jest.fn(async (input: { id: string; userId: string; type: AuthTokenType; hash: string; expiresAt: Date }) => {
      tokens.set(input.hash, { userId: input.userId, type: input.type, expiresAt: input.expiresAt });
      return input;
    }),
    findToken: jest.fn(async (hash: string, type: AuthTokenType) => {
      const token = tokens.get(hash);
      return token?.type === type && token.expiresAt > new Date() ? { type, hash, userId: token.userId, expiresAt: token.expiresAt } : null;
    }),
    consumeToken: jest.fn(async (hash: string) => tokens.delete(hash)),
  };
  const email = { sendVerification: jest.fn(async () => undefined) };
  const hasher = { hash: jest.fn(async (value: string) => `hashed:${value}`), verify: jest.fn(async () => false) };
  const checker = { isCompromised: jest.fn(async () => false) };
  return { repository, email, hasher, checker, users, tokens };
}

describe('IdentityService', () => {
  it('registers a normalized unverified user and sends verification after persistence', async () => {
    const dependencies = makeDependencies();
    const service = new IdentityService(dependencies.repository, dependencies.hasher, dependencies.email, dependencies.checker);

    const result = await service.register({ email: ' Person@Example.COM ', password: 'SecurePass1!' });

    expect(result).toEqual({ accepted: true });
    expect(dependencies.repository.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'person@example.com', passwordHash: 'hashed:SecurePass1!' }), expect.anything());
    expect(dependencies.email.sendVerification).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'person@example.com' }));
    expect([...dependencies.users.values()][0]?.status).toBe(UserStatus.UNVERIFIED);
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('returns the same public registration response for duplicate emails', async () => {
    const dependencies = makeDependencies();
    const service = new IdentityService(dependencies.repository, dependencies.hasher, dependencies.email, dependencies.checker);
    await service.register({ email: 'person@example.com', password: 'SecurePass1!' });
    dependencies.repository.createUser.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'CONFLICT' }));

    await expect(service.register({ email: 'PERSON@example.com', password: 'SecurePass1!' })).resolves.toEqual({ accepted: true });
    expect(dependencies.email.sendVerification).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid passwords before creating a user', async () => {
    const dependencies = makeDependencies();
    const service = new IdentityService(dependencies.repository, dependencies.hasher, dependencies.email, dependencies.checker);

    await expect(service.register({ email: 'person@example.com', password: 'short' })).rejects.toThrow('Invalid password');
    expect(dependencies.repository.createUser).not.toHaveBeenCalled();
  });

  it('verifies a token once and activates the user', async () => {
    const dependencies = makeDependencies();
    const service = new IdentityService(dependencies.repository, dependencies.hasher, dependencies.email, dependencies.checker);
    await service.register({ email: 'person@example.com', password: 'SecurePass1!' });
    const calls = dependencies.email.sendVerification.mock.calls as unknown[][];
    const actionUrl = (calls[0]?.[0] as { actionUrl: string }).actionUrl;
    const rawToken = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;

    await expect(service.verifyEmail(rawToken)).resolves.toEqual({ verified: true });
    expect([...dependencies.users.values()][0]?.status).toBe(UserStatus.ACTIVE);
    await expect(service.verifyEmail(rawToken)).resolves.toEqual({ verified: false });
    expect(dependencies.repository.updateUser).toHaveBeenCalledTimes(1);
  });

  it('returns a safe failure for invalid and expired verification tokens', async () => {
    const dependencies = makeDependencies();
    const service = new IdentityService(dependencies.repository, dependencies.hasher, dependencies.email, dependencies.checker);

    await expect(service.verifyEmail('not-a-real-token')).resolves.toEqual({ verified: false });
    dependencies.repository.findToken.mockResolvedValueOnce(null);
    await expect(service.verifyEmail('expired-token')).resolves.toEqual({ verified: false });
    expect(dependencies.repository.updateUser).not.toHaveBeenCalled();
  });
});

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ApiConfig } from '@commerce/config';
import { AuthTokenType } from '../domain/auth-token';
import { normalizeEmail } from '../domain/email';
import { validatePassword, type CompromisedPasswordChecker } from '../domain/password-policy';
import { User } from '../domain/user';
import type { EmailDelivery } from './ports/email-delivery';
import type { PasswordHasher } from './ports/password-hasher';

export type IdentityStore = {
  createUser(input: { id: string; email: string; passwordHash: string }, executor?: unknown): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updateUser(user: User, executor?: unknown): Promise<void>;
  createToken(input: { id: string; userId: string; type: AuthTokenType; hash: string; expiresAt: Date; email?: string }, executor?: unknown): Promise<unknown>;
  findToken(hash: string, type: AuthTokenType, executor?: unknown): Promise<{ userId?: string; expiresAt: Date } | null>;
  consumeToken(hash: string, executor?: unknown): Promise<boolean>;
  transaction?<T>(work: (executor: unknown) => Promise<T>): Promise<T>;
};

const safeResponse = { accepted: true } as const;

export class IdentityService {
  constructor(
    private readonly repository: IdentityStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly emailDelivery: Pick<EmailDelivery, 'sendVerification'>,
    private readonly compromisedPasswordChecker: CompromisedPasswordChecker,
    private readonly config: Pick<ApiConfig, 'AUTH_VERIFICATION_TOKEN_TTL_SECONDS'> = { AUTH_VERIFICATION_TOKEN_TTL_SECONDS: 86400 },
  ) {}

  async register(input: { email: string; password: string }): Promise<{ accepted: true }> {
    const email = normalizeEmail(input.email);
    const policy = await validatePassword(input.password, this.compromisedPasswordChecker);
    if (!policy.valid) throw new Error('Invalid password');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const userId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.AUTH_VERIFICATION_TOKEN_TTL_SECONDS * 1000);

    try {
      await this.runTransaction(async (executor) => {
        const passwordHash = await this.passwordHasher.hash(input.password);
        const user = await this.repository.createUser({ id: userId, email, passwordHash }, executor);
        await this.repository.createToken({ id: randomUUID(), userId: user.id, type: AuthTokenType.VERIFICATION, hash: tokenHash, expiresAt, email }, executor);
      });
    } catch (error) {
      if (isConflict(error)) return safeResponse;
      throw error;
    }

    await this.emailDelivery.sendVerification({
      recipient: email,
      actionUrl: `/verify-email?token=${rawToken}`,
      templateData: { email },
    });
    return safeResponse;
  }

  async verifyEmail(rawToken: string): Promise<{ verified: boolean }> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.repository.findToken(hash, AuthTokenType.VERIFICATION);
    if (!token?.userId) return { verified: false };
    const user = await this.repository.findUserById(token.userId);
    if (!user) return { verified: false };
    return this.runTransaction(async (executor) => {
      if (!(await this.repository.consumeToken(hash, executor))) return { verified: false };
      try {
        user.verifyEmail();
      } catch {
        return { verified: false };
      }
      await this.repository.updateUser(user, executor);
      return { verified: true };
    });
  }

  private async runTransaction<T>(work: (executor: unknown) => Promise<T>): Promise<T> {
    return this.repository.transaction ? this.repository.transaction(work) : work(undefined);
  }
}

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && ('code' in error) && (error.code === 'CONFLICT' || error.code === '23505');
}

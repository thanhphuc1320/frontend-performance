import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ApiConfig } from '@commerce/config';
import { AuthTokenType } from '../domain/auth-token';
import { normalizeEmail } from '../domain/email';
import { validatePassword, type CompromisedPasswordChecker } from '../domain/password-policy';
import { User } from '../domain/user';
import type { EmailDelivery } from './ports/email-delivery';
import type { PasswordHasher } from './ports/password-hasher';
import { ApiError } from '../../http/api-error';
import { AuditService } from '../../audit/audit.service';
import { Inject } from '@nestjs/common';
import { API_CONFIG, COMPROMISED_PASSWORD_CHECKER, EMAIL_DELIVERY, IDENTITY_REPOSITORY, PASSWORD_HASHER } from './identity.tokens';

export type IdentityStore = {
  createUser(input: { id: string; email: string; passwordHash: string }, executor?: unknown): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updateUser(user: User, executor?: unknown): Promise<void>;
  updateEmail(userId: string, email: string, executor?: unknown): Promise<void>;
  createToken(input: { id: string; userId: string; type: AuthTokenType; hash: string; expiresAt: Date; email?: string }, executor?: unknown): Promise<unknown>;
  findToken(hash: string, type: AuthTokenType, executor?: unknown): Promise<{ userId?: string; expiresAt: Date; email?: string } | null>;
  consumeToken(hash: string, executor?: unknown): Promise<boolean>;
  transaction?<T>(work: (executor: unknown) => Promise<T>): Promise<T>;
};

const safeResponse = { accepted: true } as const;

export class IdentityService {
  constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityStore,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(EMAIL_DELIVERY)
    private readonly emailDelivery: Pick<EmailDelivery, 'sendVerification'>,
    @Inject(COMPROMISED_PASSWORD_CHECKER)
    private readonly compromisedPasswordChecker: CompromisedPasswordChecker,
    @Inject(API_CONFIG)
    private readonly config: Pick<ApiConfig, 'AUTH_VERIFICATION_TOKEN_TTL_SECONDS'> = { AUTH_VERIFICATION_TOKEN_TTL_SECONDS: 86400 },
    private readonly auditService?: AuditService,
  ) {}

  async register(input: { email: string; password: string }, requestId?: string): Promise<{ accepted: true }> {
    if (typeof input?.email !== 'string' || typeof input?.password !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request');
    let email: string;
    try {
      email = normalizeEmail(input.email);
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid email');
    }
    const policy = await validatePassword(input.password, this.compromisedPasswordChecker);
    if (!policy.valid) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid password');

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

    this.auditService?.log({
      actorUserId: userId,
      action: 'user.register',
      resourceType: 'user',
      resourceId: userId,
      requestId,
      afterData: { email, status: 'UNVERIFIED' },
    }).catch(() => {});

    return safeResponse;
  }

  async verifyEmail(rawToken: string, requestId?: string): Promise<{ verified: boolean }> {
    if (typeof rawToken !== 'string' || !rawToken.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Verification token is required');
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

      this.auditService?.log({
        actorUserId: user.id,
        action: 'user.verify',
        resourceType: 'user',
        resourceId: user.id,
        requestId,
        beforeData: { status: 'UNVERIFIED' },
        afterData: { status: 'ACTIVE' },
      }).catch(() => {});

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

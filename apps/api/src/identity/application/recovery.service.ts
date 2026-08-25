import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthTokenType } from '../domain/auth-token';
import { normalizeEmail } from '../domain/email';
import { validatePassword, type CompromisedPasswordChecker } from '../domain/password-policy';
import { User } from '../domain/user';
import type { EmailDelivery } from './ports/email-delivery';
import type { PasswordHasher } from './ports/password-hasher';
import type { IdentityStore } from './identity.service';
import { ApiError } from '../../http/api-error';
import type { ApiConfig } from '@commerce/config';

import { Inject } from '@nestjs/common';
import { SESSION_REVOKER, COMPROMISED_PASSWORD_CHECKER } from './identity.tokens';

const safeResponse = { accepted: true } as const;
const failResponse = { accepted: false } as const;

export class RecoveryService {
  constructor(
    private readonly repository: IdentityStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly emailDelivery: Pick<EmailDelivery, 'sendPasswordReset' | 'sendEmailChange'>,
    @Inject(SESSION_REVOKER)
    private readonly sessionRevoker: { revokeAllForUser(userId: string): Promise<void> },
    @Inject(COMPROMISED_PASSWORD_CHECKER)
    private readonly compromisedPasswordChecker: CompromisedPasswordChecker,
    private readonly config: Pick<ApiConfig, 'AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS' | 'AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS'>,
  ) {}

  async requestPasswordReset(input: { email: string }): Promise<{ accepted: true }> {
    const email = normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(email);
    if (!user) return safeResponse;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000);

    await this.repository.createToken({ id: randomUUID(), userId: user.id, type: AuthTokenType.PASSWORD_RESET, hash: tokenHash, expiresAt });
    await this.emailDelivery.sendPasswordReset({
      recipient: email,
      actionUrl: `/reset-password?token=${rawToken}`,
      templateData: { email },
    });
    return safeResponse;
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ accepted: boolean }> {
    if (typeof rawToken !== 'string' || !rawToken.trim()) return failResponse;
    const hash = createHash('sha256').update(rawToken).digest('hex');

    return this.runTransaction(async (executor) => {
      const token = await this.repository.findToken(hash, AuthTokenType.PASSWORD_RESET, executor);
      if (!token?.userId) return failResponse;
      const user = await this.repository.findUserById(token.userId);
      if (!user) return failResponse;

      const policy = await validatePassword(newPassword, this.compromisedPasswordChecker);
      if (!policy.valid) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid password');

      if (!(await this.repository.consumeToken(hash, executor))) return failResponse;
      const passwordHash = await this.passwordHasher.hash(newPassword);
      const updated = new User(user.id, user.email, passwordHash, user.status, user.lockUntil ?? undefined, user.failedLoginAttempts);
      await this.repository.updateUser(updated, executor);
      await this.sessionRevoker.revokeAllForUser(user.id);
      return safeResponse;
    });
  }

  async requestEmailChange(input: { userId: string; newEmail: string }): Promise<{ accepted: true }> {
    const user = await this.repository.findUserById(input.userId);
    if (!user) return safeResponse;
    const newEmail = normalizeEmail(input.newEmail);
    const existing = await this.repository.findUserByEmail(newEmail);
    if (existing && existing.id !== user.id) return safeResponse;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS * 1000);

    await this.repository.createToken({ id: randomUUID(), userId: user.id, type: AuthTokenType.EMAIL_CHANGE, hash: tokenHash, expiresAt, email: newEmail });
    await this.emailDelivery.sendEmailChange({
      recipient: newEmail,
      actionUrl: `/verify-email-change?token=${rawToken}`,
      templateData: { email: newEmail },
    });
    return safeResponse;
  }

  async verifyEmailChange(rawToken: string): Promise<{ accepted: boolean }> {
    if (typeof rawToken !== 'string' || !rawToken.trim()) return failResponse;
    const hash = createHash('sha256').update(rawToken).digest('hex');

    return this.runTransaction(async (executor) => {
      const token = await this.repository.findToken(hash, AuthTokenType.EMAIL_CHANGE, executor);
      if (!token?.userId || !token.email) return failResponse;
      const user = await this.repository.findUserById(token.userId);
      if (!user) return failResponse;

      if (!(await this.repository.consumeToken(hash, executor))) return failResponse;
      await this.repository.updateEmail(user.id, token.email, executor);
      await this.sessionRevoker.revokeAllForUser(user.id);
      return safeResponse;
    });
  }

  private async runTransaction<T>(work: (executor: unknown) => Promise<T>): Promise<T> {
    return this.repository.transaction ? this.repository.transaction(work) : work(undefined);
  }
}

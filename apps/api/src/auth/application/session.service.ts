import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SessionRepository } from '../infrastructure/session.repository';
import type { IdentityStore } from '../../identity/application/identity.service';
import type { ApiConfig } from '@commerce/config';

export type RequestContext = {
  userId: string;
  storeId?: string;
  membershipStatus?: string;
  role?: string;
  permissions?: string[];
};

const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly identityRepository: Pick<IdentityStore, 'findUserById'>,
    private readonly config: Pick<ApiConfig, 'CSRF_SECRET'>,
  ) {}

  async create(userId: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<{ sessionId: string; rawToken: string; sessionHash: string; csrfToken: string }> {
    const rawToken = randomBytes(32).toString('hex');
    const sessionHash = createHash('sha256').update(rawToken).digest('hex');
    const sessionId = randomUUID();
    const now = new Date();
    const idleExpiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS);

    await this.sessionRepository.create({
      id: sessionId,
      userId,
      sessionHash,
      lastActivityAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
      ...metadata,
    });

    const csrfToken = this.generateCsrf(rawToken);

    return { sessionId, rawToken, sessionHash, csrfToken };
  }

  async validate(rawToken: string): Promise<RequestContext | null> {
    const sessionHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.sessionRepository.findByHash(sessionHash);
    if (!session) return null;

    const user = await this.identityRepository.findUserById(session.userId);
    if (!user) return null;
    if (user.status === 'DISABLED') return null;
    if (user.isLocked()) return null;

    return { userId: session.userId };
  }

  async touch(sessionId: string): Promise<boolean> {
    const now = new Date();
    const idleExpiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    return this.sessionRepository.touch(sessionId, idleExpiresAt);
  }

  async revoke(sessionId: string): Promise<boolean> {
    return this.sessionRepository.revoke(sessionId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    return this.sessionRepository.revokeAllForUser(userId);
  }

  generateCsrf(rawToken: string): string {
    return createHmac('sha256', this.config.CSRF_SECRET).update(rawToken).digest('hex');
  }

  validateCsrf(rawToken: string, token: string): boolean {
    const expected = this.generateCsrf(rawToken);
    if (expected.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  }
}

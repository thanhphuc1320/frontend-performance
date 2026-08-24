import { timingSafeEqual } from 'node:crypto';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export enum AuthTokenType {
  VERIFICATION = 'VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
  INVITATION = 'INVITATION',
}

export class AuthToken {
  private consumed = false;
  private revoked = false;

  constructor(
    public readonly type: AuthTokenType,
    hash: string,
    public readonly expiresAt: Date,
  ) {
    if (!SHA256_HEX_PATTERN.test(hash)) {
      throw new Error('Invalid token hash');
    }
    this.hash = hash.toLowerCase();
  }

  private readonly hash: string;

  matchesHash(candidateHash: string, now: Date = new Date()): boolean {
    if (!this.isUsable(now) || !SHA256_HEX_PATTERN.test(candidateHash)) return false;

    const expected = Buffer.from(this.hash);
    const candidate = Buffer.from(candidateHash.toLowerCase());
    return timingSafeEqual(expected, candidate);
  }

  isUsable(now: Date = new Date()): boolean {
    return !this.consumed && !this.revoked && now < this.expiresAt;
  }

  consume(now: Date = new Date()): boolean {
    if (!this.isUsable(now)) return false;
    this.consumed = true;
    return true;
  }

  revoke(): void {
    this.revoked = true;
  }
}

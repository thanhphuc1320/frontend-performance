import { timingSafeEqual } from 'node:crypto';

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
    private readonly hash: string,
    public readonly expiresAt: Date,
  ) {}

  matchesHash(candidateHash: string): boolean {
    const expected = Buffer.from(this.hash);
    const candidate = Buffer.from(candidateHash);
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
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

export enum UserStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  TEMPORARILY_LOCKED = 'TEMPORARILY_LOCKED',
  DISABLED = 'DISABLED',
}

const TEMPORARY_LOCKOUT_MS = 15 * 60 * 1000;

export class User {
  private _status: UserStatus;
  private _lockUntil: Date | null;

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    status: UserStatus = UserStatus.UNVERIFIED,
    lockUntil?: Date,
  ) {
    this._status = status;
    this._lockUntil = status === UserStatus.TEMPORARILY_LOCKED
      ? lockUntil ?? new Date(Date.now() + TEMPORARY_LOCKOUT_MS)
      : null;
  }

  static active(id: string, email: string, passwordHash: string): User {
    return new User(id, email, passwordHash, UserStatus.ACTIVE);
  }

  get status(): UserStatus {
    return this._status;
  }

  get lockUntil(): Date | null {
    return this._lockUntil === null ? null : new Date(this._lockUntil);
  }

  verifyEmail(): void {
    if (this._status !== UserStatus.UNVERIFIED) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.ACTIVE;
    this._lockUntil = null;
  }

  lockTemporarily(lockedAt: Date = new Date()): void {
    if (this._status !== UserStatus.ACTIVE) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.TEMPORARILY_LOCKED;
    this._lockUntil = new Date(lockedAt.getTime() + TEMPORARY_LOCKOUT_MS);
  }

  isLocked(now: Date = new Date()): boolean {
    return this._status === UserStatus.TEMPORARILY_LOCKED && this._lockUntil !== null && now < this._lockUntil;
  }

  recordSuccessfulLogin(now: Date = new Date()): void {
    if (this.isLocked(now)) {
      throw new Error('User is temporarily locked');
    }
    if (this._status !== UserStatus.ACTIVE && this._status !== UserStatus.TEMPORARILY_LOCKED) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.ACTIVE;
    this._lockUntil = null;
  }

  disable(): void {
    if (this._status === UserStatus.DISABLED) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.DISABLED;
    this._lockUntil = null;
  }
}

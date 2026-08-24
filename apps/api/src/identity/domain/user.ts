export enum UserStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  TEMPORARILY_LOCKED = 'TEMPORARILY_LOCKED',
  DISABLED = 'DISABLED',
}

export class User {
  private _status: UserStatus;

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    status: UserStatus = UserStatus.UNVERIFIED,
  ) {
    this._status = status;
  }

  static active(id: string, email: string, passwordHash: string): User {
    return new User(id, email, passwordHash, UserStatus.ACTIVE);
  }

  get status(): UserStatus {
    return this._status;
  }

  verifyEmail(): void {
    if (this._status !== UserStatus.UNVERIFIED) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.ACTIVE;
  }

  lockTemporarily(): void {
    if (this._status !== UserStatus.ACTIVE) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.TEMPORARILY_LOCKED;
  }

  recordSuccessfulLogin(): void {
    if (this._status !== UserStatus.ACTIVE && this._status !== UserStatus.TEMPORARILY_LOCKED) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.ACTIVE;
  }

  disable(): void {
    if (this._status === UserStatus.DISABLED) {
      throw new Error('Invalid user transition');
    }
    this._status = UserStatus.DISABLED;
  }
}

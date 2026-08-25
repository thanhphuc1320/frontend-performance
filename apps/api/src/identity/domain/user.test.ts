import { User, UserStatus } from './user';

describe('User', () => {
  it('starts unverified and becomes active after email verification', () => {
    const user = new User('user-1', 'alice@example.com', 'password-hash');

    expect(user.status).toBe(UserStatus.UNVERIFIED);
    user.verifyEmail();
    expect(user.status).toBe(UserStatus.ACTIVE);
  });

  it('keeps a user locked during the fifteen-minute lockout window', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');
    const lockedAt = new Date('2026-08-24T00:00:00Z');

    user.lockTemporarily(lockedAt);
    expect(user.status).toBe(UserStatus.TEMPORARILY_LOCKED);
    expect(user.isLocked(new Date('2026-08-24T00:14:59Z'))).toBe(true);
    expect(() => user.recordSuccessfulLogin(new Date('2026-08-24T00:14:59Z'))).toThrow('User is temporarily locked');
    expect(user.status).toBe(UserStatus.TEMPORARILY_LOCKED);
  });

  it('allows successful authentication after the fifteen-minute lockout expires', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');
    const lockedAt = new Date('2026-08-24T00:00:00Z');

    user.lockTemporarily(lockedAt);
    user.recordSuccessfulLogin(new Date('2026-08-24T00:15:00Z'));

    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.isLocked(new Date('2026-08-24T00:15:00Z'))).toBe(false);
  });

  it('does not expose a mutable lockout deadline', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');
    const lockedAt = new Date('2026-08-24T00:00:00Z');

    user.lockTemporarily(lockedAt);
    const exposedDeadline = user.lockUntil;
    const storedDeadline = exposedDeadline?.getTime();
    exposedDeadline?.setTime(0);

    expect(user.lockUntil?.getTime()).toBe(storedDeadline);
    expect(user.isLocked(new Date('2026-08-24T00:14:59Z'))).toBe(true);
  });

  it('does not allow disabled users to transition back to active', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');

    user.disable();
    expect(user.status).toBe(UserStatus.DISABLED);
    expect(() => user.verifyEmail()).toThrow('Invalid user transition');
    expect(() => user.recordSuccessfulLogin()).toThrow('Invalid user transition');
  });

  it('allows unverified users to record successful login without changing status', () => {
    const user = new User('user-1', 'alice@example.com', 'password-hash');
    user.recordFailedLogin(5);

    user.recordSuccessfulLogin();

    expect(user.status).toBe(UserStatus.UNVERIFIED);
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('tracks failed login attempts and locks after threshold', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');

    expect(user.failedLoginAttempts).toBe(0);
    user.recordFailedLogin(5);
    expect(user.failedLoginAttempts).toBe(1);
    user.recordFailedLogin(5);
    expect(user.failedLoginAttempts).toBe(2);
    user.recordFailedLogin(5);
    user.recordFailedLogin(5);
    user.recordFailedLogin(5);
    expect(user.failedLoginAttempts).toBe(5);
    expect(user.status).toBe(UserStatus.TEMPORARILY_LOCKED);
    expect(user.isLocked()).toBe(true);
  });

  it('resets failed attempts on successful login', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');
    user.recordFailedLogin(5);
    user.recordFailedLogin(5);
    expect(user.failedLoginAttempts).toBe(2);

    user.recordSuccessfulLogin();

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.status).toBe(UserStatus.ACTIVE);
  });
});

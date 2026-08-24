import { User, UserStatus } from './user';

describe('User', () => {
  it('starts unverified and becomes active after email verification', () => {
    const user = new User('user-1', 'alice@example.com', 'password-hash');

    expect(user.status).toBe(UserStatus.UNVERIFIED);
    user.verifyEmail();
    expect(user.status).toBe(UserStatus.ACTIVE);
  });

  it('allows temporary lockout and clears it after successful authentication', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');

    user.lockTemporarily();
    expect(user.status).toBe(UserStatus.TEMPORARILY_LOCKED);
    user.recordSuccessfulLogin();
    expect(user.status).toBe(UserStatus.ACTIVE);
  });

  it('does not allow disabled users to transition back to active', () => {
    const user = User.active('user-1', 'alice@example.com', 'password-hash');

    user.disable();
    expect(user.status).toBe(UserStatus.DISABLED);
    expect(() => user.verifyEmail()).toThrow('Invalid user transition');
  });
});

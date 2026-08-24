import { AuthToken, AuthTokenType } from './auth-token';

describe('AuthToken', () => {
  it('matches its stored hash while not exposing raw token material', () => {
    const token = new AuthToken(AuthTokenType.PASSWORD_RESET, 'hashed-token', new Date('2026-08-24T00:00:00Z'));

    expect(token.matchesHash('hashed-token')).toBe(true);
    expect(token.matchesHash('other-hash')).toBe(false);
    expect(token).not.toHaveProperty('rawToken');
  });

  it('rejects expired tokens', () => {
    const token = new AuthToken(AuthTokenType.VERIFICATION, 'hashed-token', new Date('2026-08-23T00:00:00Z'));

    expect(token.isUsable(new Date('2026-08-23T00:00:01Z'))).toBe(false);
  });

  it('consumes a token only once', () => {
    const token = new AuthToken(AuthTokenType.EMAIL_CHANGE, 'hashed-token', new Date('2026-08-24T00:00:00Z'));
    const now = new Date('2026-08-23T00:00:00Z');

    expect(token.consume(now)).toBe(true);
    expect(token.consume(now)).toBe(false);
    expect(token.isUsable(now)).toBe(false);
  });

  it('rejects revoked tokens', () => {
    const token = new AuthToken(AuthTokenType.INVITATION, 'hashed-token', new Date('2026-08-31T00:00:00Z'));

    token.revoke();

    expect(token.isUsable(new Date('2026-08-24T00:00:00Z'))).toBe(false);
    expect(token.consume(new Date('2026-08-24T00:00:00Z'))).toBe(false);
  });
});

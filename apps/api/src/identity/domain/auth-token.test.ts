import { AuthToken, AuthTokenType } from './auth-token';

const TOKEN_HASH = 'a'.repeat(64);

describe('AuthToken', () => {
  it('matches its stored hash while not exposing raw token material', () => {
    const token = new AuthToken(AuthTokenType.PASSWORD_RESET, TOKEN_HASH, new Date('2026-08-24T00:00:00Z'));

    const now = new Date('2026-08-23T00:00:00Z');

    expect(token.matchesHash(TOKEN_HASH, now)).toBe(true);
    expect(token.matchesHash('b'.repeat(64), now)).toBe(false);
    expect(token).not.toHaveProperty('rawToken');
  });

  it('rejects expired tokens', () => {
    const token = new AuthToken(AuthTokenType.VERIFICATION, TOKEN_HASH, new Date('2026-08-23T00:00:00Z'));

    expect(token.isUsable(new Date('2026-08-23T00:00:01Z'))).toBe(false);
    expect(token.matchesHash(TOKEN_HASH)).toBe(false);
  });

  it('consumes a token only once', () => {
    const token = new AuthToken(AuthTokenType.EMAIL_CHANGE, TOKEN_HASH, new Date('2026-08-24T00:00:00Z'));
    const now = new Date('2026-08-23T00:00:00Z');

    expect(token.consume(now)).toBe(true);
    expect(token.consume(now)).toBe(false);
    expect(token.isUsable(now)).toBe(false);
    expect(token.matchesHash(TOKEN_HASH)).toBe(false);
  });

  it('rejects revoked tokens', () => {
    const token = new AuthToken(AuthTokenType.INVITATION, TOKEN_HASH, new Date('2026-08-31T00:00:00Z'));

    token.revoke();

    expect(token.isUsable(new Date('2026-08-24T00:00:00Z'))).toBe(false);
    expect(token.consume(new Date('2026-08-24T00:00:00Z'))).toBe(false);
    expect(token.matchesHash(TOKEN_HASH)).toBe(false);
  });

  it('rejects malformed stored and candidate hashes safely', () => {
    expect(() => new AuthToken(AuthTokenType.VERIFICATION, 'not-a-sha256-hash', new Date('2026-08-31T00:00:00Z'))).toThrow(
      'Invalid token hash',
    );

    const token = new AuthToken(AuthTokenType.VERIFICATION, TOKEN_HASH, new Date('2026-08-31T00:00:00Z'));

    expect(token.matchesHash('short')).toBe(false);
    expect(token.matchesHash('g'.repeat(64))).toBe(false);
  });
});

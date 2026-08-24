import { loadApiConfig } from '@commerce/config';
import { Argon2idPasswordHasher, HibpPasswordChecker, SmtpEmailDelivery } from './production-adapters';

describe('production identity adapters', () => {
  it('uses Argon2id and verifies its hashes through the approved port', async () => {
    const hasher = new Argon2idPasswordHasher();
    const encoded = await hasher.hash('a secure password');

    await expect(hasher.verify('a secure password', encoded)).resolves.toBe(true);
    await expect(hasher.verify('wrong password', encoded)).resolves.toBe(false);
    expect(encoded).toContain('$argon2id$');
  });

  it('fails closed when HIBP is unavailable', async () => {
    const checker = new HibpPasswordChecker(async () => { throw new Error('network unavailable'); });

    await expect(checker.isCompromised('ABCDE', '123')).rejects.toThrow('network unavailable');
  });

  it('requires SMTP configuration for the production email adapter', () => {
    const config = loadApiConfig({ NODE_ENV: 'production', API_PORT: '4000', DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', SESSION_COOKIE_NAME: 'session', CORS_ORIGIN: 'https://example.com', AUTH_LOCKOUT_MAX_ATTEMPTS: '5', AUTH_LOCKOUT_DURATION_SECONDS: '900', AUTH_VERIFICATION_TOKEN_TTL_SECONDS: '86400', AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: '3600', AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: '3600', EMAIL_DELIVERY_MODE: 'smtp', EMAIL_FROM: 'no-reply@example.com', SMTP_URL: 'smtps://smtp.example.com', CSRF_SECRET: 'a'.repeat(32) });
    expect(new SmtpEmailDelivery(config).from).toBe(config.EMAIL_FROM);
  });
});

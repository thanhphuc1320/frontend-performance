import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadApiConfig } from './index';

const validDevelopmentEnv = {
  NODE_ENV: 'development',
  API_PORT: '4000',
  DATABASE_URL: 'postgresql://localhost:5432/commerce',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_COOKIE_NAME: 'commerce_session',
  CORS_ORIGIN: 'http://localhost:3000',
};

describe('loadApiConfig', () => {
  it('loads a valid development environment into a typed config', () => {
    assert.deepEqual(loadApiConfig(validDevelopmentEnv), {
      NODE_ENV: 'development',
      API_PORT: 4000,
      DATABASE_URL: 'postgresql://localhost:5432/commerce',
      REDIS_URL: 'redis://localhost:6379',
      SESSION_COOKIE_NAME: 'commerce_session',
      CORS_ORIGIN: 'http://localhost:3000',
      AUTH_LOCKOUT_MAX_ATTEMPTS: 5,
      AUTH_LOCKOUT_DURATION_SECONDS: 900,
      AUTH_VERIFICATION_TOKEN_TTL_SECONDS: 86400,
      AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: 3600,
      AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: 3600,
      EMAIL_DELIVERY_MODE: 'memory',
      EMAIL_FROM: 'no-reply@localhost.test',
      SMTP_URL: 'smtps://localhost.test',
      CSRF_SECRET: 'local-development-csrf-secret-32',
    });
  });

  it('loads the same deterministic Auth defaults in test environments', () => {
    const config = loadApiConfig({ ...validDevelopmentEnv, NODE_ENV: 'test' });

    assert.equal(config.AUTH_LOCKOUT_MAX_ATTEMPTS, 5);
    assert.equal(config.AUTH_VERIFICATION_TOKEN_TTL_SECONDS, 86400);
    assert.equal(config.EMAIL_DELIVERY_MODE, 'memory');
    assert.equal(config.CSRF_SECRET, 'local-development-csrf-secret-32');
  });

  it('reports missing required fields without exposing environment values', () => {
    const env = { ...validDevelopmentEnv, DATABASE_URL: undefined };

    assert.throws(() => loadApiConfig(env), (error: unknown) => {
      assert.match(error instanceof Error ? error.message : '', /DATABASE_URL/);
      assert.doesNotMatch(error instanceof Error ? error.message : '', /commerce|postgresql/);
      return true;
    });
  });

  it('rejects ports outside the valid TCP range', () => {
    assert.throws(() => loadApiConfig({ ...validDevelopmentEnv, API_PORT: '70000' }), /API_PORT/);
  });

  it('rejects invalid database, redis, and CORS URLs', () => {
    for (const field of ['DATABASE_URL', 'REDIS_URL', 'CORS_ORIGIN'] as const) {
      assert.throws(() => loadApiConfig({ ...validDevelopmentEnv, [field]: 'not-a-url' }), new RegExp(field));
    }
  });

  it('rejects placeholder session configuration in production', () => {
    assert.throws(
      () => loadApiConfig({ ...validDevelopmentEnv, NODE_ENV: 'production', SESSION_COOKIE_NAME: 'change-me' }),
      /SESSION_COOKIE_NAME/,
    );
  });

  it('requires production Auth settings', () => {
    assert.throws(
      () => loadApiConfig({ ...validDevelopmentEnv, NODE_ENV: 'production' }),
      /(?=.*AUTH_LOCKOUT_MAX_ATTEMPTS)(?=.*AUTH_LOCKOUT_DURATION_SECONDS)(?=.*CSRF_SECRET)/,
    );
  });

  it('rejects production CSRF secrets containing placeholder patterns', () => {
    const productionEnv = {
      ...validDevelopmentEnv,
      NODE_ENV: 'production',
      AUTH_LOCKOUT_MAX_ATTEMPTS: '5',
      AUTH_LOCKOUT_DURATION_SECONDS: '900',
      AUTH_VERIFICATION_TOKEN_TTL_SECONDS: '86400',
      AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: '3600',
      AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: '3600',
      EMAIL_DELIVERY_MODE: 'smtp',
      EMAIL_FROM: 'no-reply@commerce-control.io',
      SMTP_URL: 'smtps://smtp.mailgun.org',
    };

    for (const value of ['a-placeholder-secret-value-123456789', 'change-me-123456789012345678901234', 'myExampleSecret123456789012345678']) {
      assert.throws(() => loadApiConfig({ ...productionEnv, CSRF_SECRET: value }), /CSRF_SECRET/);
    }
  });

  it('loads valid production Auth settings', () => {
    const config = loadApiConfig({
      ...validDevelopmentEnv,
      NODE_ENV: 'production',
      AUTH_LOCKOUT_MAX_ATTEMPTS: '5',
      AUTH_LOCKOUT_DURATION_SECONDS: '900',
      AUTH_VERIFICATION_TOKEN_TTL_SECONDS: '86400',
      AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: '3600',
      AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: '3600',
      EMAIL_DELIVERY_MODE: 'smtp',
      EMAIL_FROM: 'no-reply@commerce-control.io',
      SMTP_URL: 'smtps://smtp.mailgun.org',
      CSRF_SECRET: 'a-valid-production-csrf-key-123456789',
    });

    assert.equal(config.EMAIL_DELIVERY_MODE, 'smtp');
    assert.equal(config.CSRF_SECRET, 'a-valid-production-csrf-key-123456789');
  });

  it('rejects memory delivery in production', () => {
    assert.throws(() => loadApiConfig({
      ...validDevelopmentEnv,
      NODE_ENV: 'production',
      AUTH_LOCKOUT_MAX_ATTEMPTS: '5', AUTH_LOCKOUT_DURATION_SECONDS: '900',
      AUTH_VERIFICATION_TOKEN_TTL_SECONDS: '86400', AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: '3600', AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: '3600',
      EMAIL_DELIVERY_MODE: 'memory', EMAIL_FROM: 'no-reply@example.test', SMTP_URL: 'smtps://smtp.example.test', CSRF_SECRET: 'a-valid-production-csrf-key-123456789',
    }), /EMAIL_DELIVERY_MODE/);
  });

  it('rejects placeholder SMTP URLs and sender addresses in production', () => {
    const productionEnv = {
      ...validDevelopmentEnv,
      NODE_ENV: 'production',
      AUTH_LOCKOUT_MAX_ATTEMPTS: '5', AUTH_LOCKOUT_DURATION_SECONDS: '900',
      AUTH_VERIFICATION_TOKEN_TTL_SECONDS: '86400', AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: '3600', AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: '3600',
      EMAIL_DELIVERY_MODE: 'smtp', EMAIL_FROM: 'no-reply@commerce-control.io', SMTP_URL: 'smtps://smtp.mailgun.org', CSRF_SECRET: 'a-valid-production-csrf-key-123456789',
    };

    for (const value of ['smtps://smtp.example.com', 'smtps://change-me.smtp.internal', 'smtp://localhost:2525']) {
      assert.throws(() => loadApiConfig({ ...productionEnv, SMTP_URL: value }), /SMTP_URL/);
    }
    for (const value of ['no-reply@example.com', 'no-reply@change-me.invalid']) {
      assert.throws(() => loadApiConfig({ ...productionEnv, EMAIL_FROM: value }), /EMAIL_FROM/);
    }
  });
});

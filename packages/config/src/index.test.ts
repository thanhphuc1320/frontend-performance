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
    });
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
});

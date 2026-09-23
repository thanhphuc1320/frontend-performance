import { strict as assert } from 'node:assert';
import { bootstrap } from './main';

const validEnvironment = {
  NODE_ENV: 'development',
  API_PORT: '4100',
  DATABASE_URL: 'postgresql://localhost:5432/commerce',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_COOKIE_NAME: 'commerce_session',
  CORS_ORIGIN: 'http://localhost:3000',
};

describe('API bootstrap', () => {
  it('does not create a Nest application when configuration is invalid', async () => {
    let createCalls = 0;

    await assert.rejects(
      bootstrap({ ...validEnvironment, DATABASE_URL: undefined }, async () => {
        createCalls += 1;
        return { use: () => undefined, listen: async () => undefined, enableCors: () => undefined };
      }),
      /DATABASE_URL/,
    );

    assert.equal(createCalls, 0);
  });

  it('creates the application only after validation and listens on the validated port', async () => {
    let listenPort: number | undefined;
    let createCalls = 0;

    await bootstrap(validEnvironment, async () => {
      createCalls += 1;
      return {
        use: () => undefined,
        enableCors: () => undefined,
        listen: async (port: number) => {
          listenPort = port;
        },
      };
    });

    assert.equal(createCalls, 1);
    assert.equal(listenPort, 4100);
  });
});

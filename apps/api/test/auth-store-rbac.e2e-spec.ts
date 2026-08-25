import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { EMAIL_DELIVERY, IDENTITY_REPOSITORY } from '../src/identity/application/identity.tokens';
import type { MemoryEmailDelivery } from '../src/identity/infrastructure/test-adapters';
import type { IdentityStore } from '../src/identity/application/identity.service';
import { randomUUID } from 'node:crypto';
import { DATABASE, type PostgresDatabase } from '../src/infrastructure/database.provider';
import { STORE_REPOSITORY } from '../src/stores/application/store.tokens';
import type { StoreRepository } from '../src/stores/infrastructure/store.repository';

describe('auth and Store foundation', () => {
  it('boots the real AppModule and runs registration through Store selection', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const identity = app.get<IdentityStore>(IDENTITY_REPOSITORY);
    const address = `person-${Date.now()}@example.com`;

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201).expect({ data: { accepted: true } });
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address.toUpperCase(), password: 'a secure password' }).expect(201).expect({ data: { accepted: true } });
    const user = await identity.findUserByEmail(address);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200).expect({ data: { verified: true } });

    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: address, password: 'a secure password' }).expect(200);
    expect(loginRes.body.data.userId).toBe(user!.id);
    const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    expect(sessionCookie).toBeDefined();
    expect(csrfCookie).toBeDefined();
    const csrfToken = csrfCookie.split(';')[0]!.split('=')[1];

    const authHeaders = { 'x-csrf-token': csrfToken };
    const authCookie = `${sessionCookie}; ${csrfCookie}`;

    await request(app.getHttpServer()).get('/api/v1/stores').set('Cookie', authCookie).expect(200).expect((response) => expect(response.body.data).toHaveLength(0));

    const unverifiedAddress = `unverified-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: unverifiedAddress, password: 'a secure password' }).expect(201);
    const unverifiedLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: unverifiedAddress, password: 'a secure password' }).expect(200);
    const unverifiedCookie = unverifiedLogin.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const unverifiedCsrf = unverifiedLogin.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', `${unverifiedCookie}; ${unverifiedCsrf}`).set('x-csrf-token', unverifiedCsrf.split(';')[0]!.split('=')[1]).send({ name: 'Blocked Store' }).expect(403).expect((response) => expect(response.body.error).toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' }));

    await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', authCookie).set(authHeaders).send({ name: 'Invalid Timezone', timezone: 'not/a-timezone' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', authCookie).set(authHeaders).send({ name: 'Invalid Currency', currency: 'USD' }).expect(400);

    const first = await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', authCookie).set(authHeaders).set('idempotency-key', 'first-store-request').send({ name: 'First Store' }).expect(201);
    const second = await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', authCookie).set(authHeaders).set('idempotency-key', 'first-store-request').send({ name: 'First Store' }).expect(201);
    expect(second.body.data.store.id).toBe(first.body.data.store.id);
    await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', authCookie).set(authHeaders).set('idempotency-key', 'first-store-request').send({ name: 'Different Store' }).expect(409).expect((response) => expect(response.body.error).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }));

    const stores = app.get<StoreRepository>(STORE_REPOSITORY);
    await expect(stores.transaction(async (executor) => {
      const created = await stores.createStore({ id: randomUUID(), name: 'Rolled Back Store', createdBy: user!.id, idempotencyKey: 'rollback-request' }, executor);
      await stores.createMembership({ id: randomUUID(), storeId: created.id, userId: user!.id, roleCode: 'NOT_A_ROLE' }, executor);
      return created;
    })).rejects.toThrow('Role not found');
    expect((await stores.listForUser(user!.id)).some((store) => store.name === 'Rolled Back Store')).toBe(false);

    await request(app.getHttpServer()).get('/api/v1/stores').set('Cookie', authCookie).expect(200).expect((response) => expect(response.body.data).toHaveLength(1));
    await request(app.getHttpServer()).post(`/api/v1/stores/${first.body.data.store.id}/select`).set('Cookie', authCookie).set(authHeaders).expect(200).expect({ data: { storeId: first.body.data.store.id } });
    await request(app.getHttpServer()).post(`/api/v1/stores/${randomUUID()}/select`).set('Cookie', authCookie).set(authHeaders).expect(403).expect((response) => expect(response.body.error).toMatchObject({ code: 'STORE_ACCESS_DENIED', requestId: expect.any(String) }));

    const database = app.get<PostgresDatabase>(DATABASE);
    await database.query('UPDATE stores SET status = \'DEACTIVATED\' WHERE id = $1', [first.body.data.store.id]);
    await request(app.getHttpServer()).get('/api/v1/stores').set('Cookie', authCookie).expect(200).expect({ data: [] });
    await request(app.getHttpServer()).post(`/api/v1/stores/${first.body.data.store.id}/select`).set('Cookie', authCookie).set(authHeaders).expect(403);

    const otherAddress = `other-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: otherAddress, password: 'a secure password' }).expect(201);
    const otherToken = new URL(`http://localhost${email.messages.at(-1)!.actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: otherToken }).expect(200);
    const otherLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: otherAddress, password: 'a secure password' }).expect(200);
    const otherCookie = otherLogin.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const otherCsrf = otherLogin.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    const otherAuthCookie = `${otherCookie}; ${otherCsrf}`;
    const otherAuthHeaders = { 'x-csrf-token': otherCsrf.split(';')[0]!.split('=')[1] };
    const otherStore = await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', otherAuthCookie).set(otherAuthHeaders).set('idempotency-key', 'other-store-request').send({ name: 'Other Store' }).expect(201);

    await request(app.getHttpServer()).get('/api/v1/stores').set('Cookie', authCookie).expect(200).expect({ data: [] });
    await request(app.getHttpServer()).post(`/api/v1/stores/${otherStore.body.data.store.id}/select`).set('Cookie', authCookie).set(authHeaders).expect(403);
    await request(app.getHttpServer()).post('/api/v1/stores').set('Cookie', authCookie).set(authHeaders).send({ name: '' }).expect(400).expect((response) => expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' }));

    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', authCookie).set(authHeaders).send({ token: 'unused' }).expect(200);
    await request(app.getHttpServer()).get('/api/v1/stores').set('Cookie', authCookie).expect(401);

    await app.close();
  });
});

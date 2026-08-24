import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EMAIL_DELIVERY, IDENTITY_REPOSITORY } from '../src/identity/application/identity.tokens';
import type { MemoryEmailDelivery } from '../src/identity/infrastructure/test-adapters';
import type { IdentityStore } from '../src/identity/application/identity.service';
import { randomUUID } from 'node:crypto';
import { DATABASE, type PostgresDatabase } from '../src/infrastructure/database.provider';
import { STORE_REPOSITORY } from '../src/stores/application/store.tokens';
import type { StoreRepository } from '../src/stores/infrastructure/store.repository';
import type { NextFunction, Request, Response } from 'express';

describe('auth and Store foundation', () => {
  it('boots the real AppModule and runs registration through Store selection', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use((request: Request & { userId?: string }, _response: Response, next: NextFunction) => {
      request.userId = request.header('x-test-user-id')?.trim();
      next();
    });
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

    const headers = { 'x-test-user-id': user!.id, 'idempotency-key': 'first-store-request' };
    await request(app.getHttpServer()).get('/api/v1/stores').expect(401).expect((response) => expect(response.body.error).toMatchObject({ code: 'UNAUTHENTICATED' }));
    const unverifiedAddress = `unverified-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: unverifiedAddress, password: 'a secure password' }).expect(201);
    const unverified = await identity.findUserByEmail(unverifiedAddress);
    await request(app.getHttpServer()).post('/api/v1/stores').set({ 'x-test-user-id': unverified!.id, 'idempotency-key': 'unverified-request' }).send({ name: 'Blocked Store' }).expect(403).expect((response) => expect(response.body.error).toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' }));
    await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'Invalid Timezone', timezone: 'not/a-timezone' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'Invalid Currency', currency: 'USD' }).expect(400);
    const first = await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'First Store' }).expect(201);
    const second = await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'First Store' }).expect(201);
    expect(second.body.data.store.id).toBe(first.body.data.store.id);
    await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'Different Store' }).expect(409).expect((response) => expect(response.body.error).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }));
    const stores = app.get<StoreRepository>(STORE_REPOSITORY);
    await expect(stores.transaction(async (executor) => {
      const created = await stores.createStore({ id: randomUUID(), name: 'Rolled Back Store', createdBy: user!.id, idempotencyKey: 'rollback-request' }, executor);
      await stores.createMembership({ id: randomUUID(), storeId: created.id, userId: user!.id, roleCode: 'NOT_A_ROLE' }, executor);
      return created;
    })).rejects.toThrow('Role not found');
    expect((await stores.listForUser(user!.id)).some((store) => store.name === 'Rolled Back Store')).toBe(false);
    await request(app.getHttpServer()).get('/api/v1/stores').set(headers).expect(200).expect((response) => expect(response.body.data).toHaveLength(1));
    await request(app.getHttpServer()).post(`/api/v1/stores/${first.body.data.store.id}/select`).set(headers).expect(200).expect({ data: { storeId: first.body.data.store.id } });
    await request(app.getHttpServer()).post(`/api/v1/stores/${randomUUID()}/select`).set(headers).expect(403).expect((response) => expect(response.body.error).toMatchObject({ code: 'STORE_ACCESS_DENIED', requestId: expect.any(String) }));
    const database = app.get<PostgresDatabase>(DATABASE);
    await database.query('UPDATE stores SET status = \'DEACTIVATED\' WHERE id = $1', [first.body.data.store.id]);
    await request(app.getHttpServer()).get('/api/v1/stores').set(headers).expect(200).expect({ data: [] });
    await request(app.getHttpServer()).post(`/api/v1/stores/${first.body.data.store.id}/select`).set(headers).expect(403);
    const otherAddress = `other-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: otherAddress, password: 'a secure password' }).expect(201);
    const other = await identity.findUserByEmail(otherAddress);
    const otherToken = new URL(`http://localhost${email.messages.at(-1)!.actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: otherToken }).expect(200);
    const otherHeaders = { 'x-test-user-id': other!.id, 'idempotency-key': 'other-store-request' };
    const otherStore = await request(app.getHttpServer()).post('/api/v1/stores').set(otherHeaders).send({ name: 'Other Store' }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/stores').set(headers).expect(200).expect({ data: [] });
    await request(app.getHttpServer()).post(`/api/v1/stores/${otherStore.body.data.store.id}/select`).set(headers).expect(403);
    await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: '' }).expect(400).expect((response) => expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' }));
    await app.close();
  });
});

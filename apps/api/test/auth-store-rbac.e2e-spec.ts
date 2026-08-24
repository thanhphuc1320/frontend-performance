import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EMAIL_DELIVERY, IDENTITY_REPOSITORY } from '../src/identity/application/identity.tokens';
import type { MemoryEmailDelivery } from '../src/identity/infrastructure/test-adapters';
import type { IdentityStore } from '../src/identity/application/identity.service';
import { randomUUID } from 'node:crypto';

describe('auth and Store foundation', () => {
  it('boots the real AppModule and runs registration through Store selection', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    await app.init();
    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const identity = app.get<IdentityStore>(IDENTITY_REPOSITORY);
    const address = `person-${Date.now()}@example.com`;

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201).expect({ data: { accepted: true } });
    const user = await identity.findUserByEmail(address);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200).expect({ data: { verified: true } });

    const headers = { 'x-test-user-id': user!.id, 'idempotency-key': 'first-store-request' };
    const first = await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'First Store' }).expect(201);
    const second = await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: 'First Store' }).expect(201);
    expect(second.body.data.store.id).toBe(first.body.data.store.id);
    await request(app.getHttpServer()).get('/api/v1/stores').set(headers).expect(200).expect((response) => expect(response.body.data).toHaveLength(1));
    await request(app.getHttpServer()).post(`/api/v1/stores/${first.body.data.store.id}/select`).set(headers).expect(200).expect({ data: { storeId: first.body.data.store.id } });
    await request(app.getHttpServer()).post(`/api/v1/stores/${randomUUID()}/select`).set(headers).expect(403).expect((response) => expect(response.body.error).toMatchObject({ code: 'STORE_ACCESS_DENIED', requestId: expect.any(String) }));
    await request(app.getHttpServer()).post('/api/v1/stores').set(headers).send({ name: '' }).expect(400).expect((response) => expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' }));
    await app.close();
  });
});

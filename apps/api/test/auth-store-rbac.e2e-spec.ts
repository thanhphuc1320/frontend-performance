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

  it('covers the full critical auth and membership lifecycle', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    // Helper: register, verify, and login
    async function setupUser(emailAddress: string): Promise<{ userId: string; cookie: string; csrf: string }> {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: emailAddress, password: 'a secure password' }).expect(201);
      const actionUrl = email.messages.filter((m) => m.recipient === emailAddress).at(-1)?.actionUrl;
      const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
      await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);
      const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: emailAddress, password: 'a secure password' }).expect(200);
      const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
      const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
      const csrfToken = csrfCookie.split(';')[0]!.split('=')[1];
      return { userId: loginRes.body.data.userId, cookie: `${sessionCookie}; ${csrfCookie}`, csrf: csrfToken };
    }

    // 1. Owner registration, verification, first Store
    const ownerAddress = `flow-owner-${Date.now()}@example.com`;
    const owner = await setupUser(ownerAddress);

    const storeRes = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', owner.cookie)
      .set('x-csrf-token', owner.csrf)
      .set('idempotency-key', `flow-store-${Date.now()}`)
      .send({ name: 'Flow Store' })
      .expect(201);
    const storeId = storeRes.body.data.store.id;
    expect(storeRes.body.data.membership.roleCode).toBe('OWNER');

    // 2. Select Store
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/select`)
      .set('Cookie', owner.cookie)
      .set('x-csrf-token', owner.csrf)
      .expect(200)
      .expect({ data: { storeId } });

    // 3. Logout
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', owner.cookie)
      .set('x-csrf-token', owner.csrf)
      .send({ token: 'unused' })
      .expect(200);

    // 4. Password recovery flow
    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset-request')
      .send({ email: ownerAddress })
      .expect(200);

    const resetActionUrl = email.messages.find((m) => m.recipient === ownerAddress && m.actionUrl.includes('reset-password'))?.actionUrl;
    const resetToken = new URL(`http://localhost${resetActionUrl}`).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset')
      .send({ token: resetToken, password: 'recovered secure password' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.accepted).toBe(true);
      });

    // Login with new password
    const recoveredLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerAddress, password: 'recovered secure password' })
      .expect(200);
    const recoveredSession = recoveredLogin.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const recoveredCsrf = recoveredLogin.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    const recoveredCookie = `${recoveredSession}; ${recoveredCsrf}`;
    const recoveredCsrfToken = recoveredCsrf.split(';')[0]!.split('=')[1];

    // 5. Invite a new user
    const inviteeAddress = `flow-invitee-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invitations`)
      .set('Cookie', recoveredCookie)
      .set('x-csrf-token', recoveredCsrfToken)
      .send({ email: inviteeAddress, roleCode: 'ADMIN' })
      .expect(201);

    // 6. Invitee registers, verifies, and accepts invitation
    const invitee = await setupUser(inviteeAddress);
    const inviteActionUrl = email.messages.find((m) => m.recipient === inviteeAddress && m.actionUrl.includes('invitations'))?.actionUrl;
    const inviteToken = new URL(`http://localhost${inviteActionUrl}`).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Cookie', invitee.cookie)
      .set('x-csrf-token', invitee.csrf)
      .send({ token: inviteToken })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.membership.roleCode).toBe('ADMIN');
      });

    // 7. Store switch by invitee
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/select`)
      .set('Cookie', invitee.cookie)
      .set('x-csrf-token', invitee.csrf)
      .expect(200)
      .expect({ data: { storeId } });

    // Invitee lists members
    const membersRes = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/members`)
      .set('Cookie', invitee.cookie)
      .expect(200);
    expect(membersRes.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: owner.userId, roleCode: 'OWNER', status: 'ACTIVE' }),
      expect.objectContaining({ userId: invitee.userId, roleCode: 'ADMIN', status: 'ACTIVE' }),
    ]));

    // 8. Role change: Owner downgrades Admin to Staff
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/members/${invitee.userId}/role`)
      .set('Cookie', recoveredCookie)
      .set('x-csrf-token', recoveredCsrfToken)
      .send({ roleCode: 'STAFF' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.roleCode).toBe('STAFF');
      });

    // 9. Admin (now Staff) tries to manage members -> forbidden
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/members/${invitee.userId}/role`)
      .set('Cookie', invitee.cookie)
      .set('x-csrf-token', invitee.csrf)
      .send({ roleCode: 'ADMIN' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('PERMISSION_DENIED');
      });

    // 10. Invitee leaves the Store
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/members/leave`)
      .set('Cookie', invitee.cookie)
      .set('x-csrf-token', invitee.csrf)
      .expect(201)
      .expect((res) => {
        expect(res.body.data.status).toBe('LEFT');
      });

    // After leaving, invitee cannot access store
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/members`)
      .set('Cookie', invitee.cookie)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('STORE_ACCESS_DENIED');
      });

    // 11. Owner removes a member (after re-inviting and accepting)
    const newMemberAddress = `flow-newmember-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invitations`)
      .set('Cookie', recoveredCookie)
      .set('x-csrf-token', recoveredCsrfToken)
      .send({ email: newMemberAddress, roleCode: 'STAFF' })
      .expect(201);

    const newMember = await setupUser(newMemberAddress);
    const newInviteActionUrl = email.messages.find((m) => m.recipient === newMemberAddress && m.actionUrl.includes('invitations'))?.actionUrl;
    const newInviteToken = new URL(`http://localhost${newInviteActionUrl}`).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Cookie', newMember.cookie)
      .set('x-csrf-token', newMember.csrf)
      .send({ token: newInviteToken })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/members/${newMember.userId}/remove`)
      .set('Cookie', recoveredCookie)
      .set('x-csrf-token', recoveredCsrfToken)
      .expect(201)
      .expect((res) => {
        expect(res.body.data.status).toBe('REMOVED');
      });

    // 12. Final owner protection persists
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/members/${owner.userId}/remove`)
      .set('Cookie', recoveredCookie)
      .set('x-csrf-token', recoveredCsrfToken)
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('FINAL_OWNER_PROTECTED');
      });

    await app.close();
  });
});

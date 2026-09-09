import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { EMAIL_DELIVERY } from '../src/identity/application/identity.tokens';
import type { MemoryEmailDelivery } from '../src/identity/infrastructure/test-adapters';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Concurrent mutation safety', () => {
  it('serializes concurrent final-Owner role changes so only one succeeds', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    // Helper to create verified user with session
    async function createVerifiedUser(emailAddress: string): Promise<{ userId: string; cookie: string; csrf: string }> {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: emailAddress, password: 'a secure password' }).expect(201);
      const actionUrl = email.messages.filter((m: any) => m.recipient === emailAddress).at(-1)?.actionUrl;
      const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
      await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);
      const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: emailAddress, password: 'a secure password' }).expect(200);
      const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
      const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
      const csrfToken = csrfCookie.split(';')[0]!.split('=')[1];
      const userId = loginRes.body.data.userId;
      return { userId, cookie: `${sessionCookie}; ${csrfCookie}`, csrf: csrfToken };
    }

    const ownerBEmail = `conc-owner-b-${Date.now()}@example.com`;
    const ownerA = await createVerifiedUser(`conc-owner-a-${Date.now()}@example.com`);
    const ownerB = await createVerifiedUser(ownerBEmail);

    // Owner A creates store
    const storeRes = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', ownerA.cookie)
      .set('x-csrf-token', ownerA.csrf)
      .set('idempotency-key', `conc-store-${Date.now()}`)
      .send({ name: 'Concurrent Store' })
      .expect(201);
    const storeId = storeRes.body.data.store.id;

    // Invite ownerB as OWNER
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invitations`)
      .set('Cookie', ownerA.cookie)
      .set('x-csrf-token', ownerA.csrf)
      .send({ email: ownerBEmail, roleCode: 'OWNER' })
      .expect(201);

    // Find invitation token for ownerB (invitation email, not verification)
    const inviteActionUrl = email.messages.find((m: any) => m.recipient === ownerBEmail && m.actionUrl.includes('invitations'))?.actionUrl;
    const inviteToken = new URL(`http://localhost${inviteActionUrl}`).searchParams.get('token')!;

    // OwnerB accepts invitation
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Cookie', ownerB.cookie)
      .set('x-csrf-token', ownerB.csrf)
      .send({ token: inviteToken })
      .expect(201);

    // Both owners try to downgrade each other to ADMIN concurrently
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/stores/${storeId}/members/${ownerB.userId}/role`)
        .set('Cookie', ownerA.cookie)
        .set('x-csrf-token', ownerA.csrf)
        .send({ roleCode: 'ADMIN' }),
      request(app.getHttpServer())
        .patch(`/api/v1/stores/${storeId}/members/${ownerA.userId}/role`)
        .set('Cookie', ownerB.cookie)
        .set('x-csrf-token', ownerB.csrf)
        .send({ roleCode: 'ADMIN' }),
    ]);

    // Exactly one should succeed (200), the other should fail with FINAL_OWNER_PROTECTED (409)
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Verify final state: exactly one OWNER remains
    const membersRes = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/members`)
      .set('Cookie', ownerA.cookie)
      .expect(200);

    const owners = membersRes.body.data.filter((m: any) => m.roleCode === 'OWNER' && m.status === 'ACTIVE');
    expect(owners).toHaveLength(1);

    await app.close();
  });

  it('creates only one Store when two requests use the same idempotency key concurrently', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    const address = `idemp-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);

    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: address, password: 'a secure password' }).expect(200);
    const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    const csrfToken = csrfCookie.split(';')[0]!.split('=')[1];
    const authCookie = `${sessionCookie}; ${csrfCookie}`;

    const idempotencyKey = `shared-key-${Date.now()}`;

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Cookie', authCookie)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', idempotencyKey)
        .send({ name: 'Same Store' }),
      request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Cookie', authCookie)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', idempotencyKey)
        .send({ name: 'Same Store' }),
    ]);

    // Both should succeed (201 or 200), and return the same store id
    expect([resA.status, resB.status]).toEqual(expect.arrayContaining([201]));
    expect(resA.body.data.store.id).toBe(resB.body.data.store.id);

    // Verify only one store exists for this user
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Cookie', authCookie)
      .expect(200);

    expect(listRes.body.data).toHaveLength(1);

    await app.close();
  });

  it('allows only one concurrent invitation acceptance to succeed', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    // Helper to create verified user with session
    async function createVerifiedUser(emailAddress: string): Promise<{ cookie: string; csrf: string }> {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: emailAddress, password: 'a secure password' }).expect(201);
      const actionUrl = email.messages.filter((m: any) => m.recipient === emailAddress).at(-1)?.actionUrl;
      const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
      await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);
      const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: emailAddress, password: 'a secure password' }).expect(200);
      const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
      const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
      const csrfToken = csrfCookie.split(';')[0]!.split('=')[1];
      return { cookie: `${sessionCookie}; ${csrfCookie}`, csrf: csrfToken };
    }

    const owner = await createVerifiedUser(`conc-inv-owner-${Date.now()}@example.com`);
    const inviteeAddress = `conc-invitee-${Date.now()}@example.com`;
    const invitee = await createVerifiedUser(inviteeAddress);

    // Create store
    const storeRes = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', owner.cookie)
      .set('x-csrf-token', owner.csrf)
      .set('idempotency-key', `conc-inv-store-${Date.now()}`)
      .send({ name: 'Invite Store' })
      .expect(201);
    const storeId = storeRes.body.data.store.id;

    // Invite invitee
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invitations`)
      .set('Cookie', owner.cookie)
      .set('x-csrf-token', owner.csrf)
      .send({ email: inviteeAddress, roleCode: 'STAFF' })
      .expect(201);

    const inviteActionUrl = email.messages.find((m: any) => m.recipient === inviteeAddress && m.actionUrl.includes('invitations'))?.actionUrl;
    const inviteToken = new URL(`http://localhost${inviteActionUrl}`).searchParams.get('token')!;

    // Two concurrent accept requests
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Cookie', invitee.cookie)
        .set('x-csrf-token', invitee.csrf)
        .send({ token: inviteToken }),
      request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Cookie', invitee.cookie)
        .set('x-csrf-token', invitee.csrf)
        .send({ token: inviteToken }),
    ]);

    // Exactly one should succeed
    const successCount = [resA, resB].filter((r) => r.status === 201).length;
    expect(successCount).toBe(1);

    // The other should fail with invitation invalid
    const failure = [resA, resB].find((r) => r.status !== 201);
    expect(failure!.status).toBe(400);
    expect(failure!.body.error.code).toBe('INVITATION_INVALID');

    await app.close();
  });

  it('allows only one concurrent password reset with the same token to succeed', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    const address = `conc-reset-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);

    // Request password reset
    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset-request')
      .send({ email: address })
      .expect(200);

    const resetActionUrl = email.messages.filter((m: any) => m.recipient === address).at(-1)?.actionUrl;
    const resetToken = new URL(`http://localhost${resetActionUrl}`).searchParams.get('token')!;

    // Two concurrent reset requests
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/password-reset')
        .send({ token: resetToken, password: 'new secure password one' }),
      request(app.getHttpServer())
        .post('/api/v1/auth/password-reset')
        .send({ token: resetToken, password: 'new secure password two' }),
    ]);

    // Exactly one should succeed
    const successCount = [resA, resB].filter((r) => r.status === 200 && r.body.data.accepted === true).length;
    expect(successCount).toBe(1);

    // The other should return accepted: false
    const failure = [resA, resB].find((r) => !(r.status === 200 && r.body.data.accepted === true));
    expect(failure!.status).toBe(200);
    expect(failure!.body.data.accepted).toBe(false);

    // Verify only one password works
    const loginWithOne = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password: 'new secure password one' });
    const loginWithTwo = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password: 'new secure password two' });

    const successfulLogins = [loginWithOne, loginWithTwo].filter((r) => r.status === 200);
    expect(successfulLogins).toHaveLength(1);

    await app.close();
  });
});

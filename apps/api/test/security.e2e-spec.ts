import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { EMAIL_DELIVERY, IDENTITY_REPOSITORY } from '../src/identity/application/identity.tokens';
import type { MemoryEmailDelivery } from '../src/identity/infrastructure/test-adapters';
import type { IdentityStore } from '../src/identity/application/identity.service';
import { DATABASE, type PostgresDatabase } from '../src/infrastructure/database.provider';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Store isolation and authorization security', () => {
  it('enforces store-scoped access controls', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const identity = app.get<IdentityStore>(IDENTITY_REPOSITORY);
    const database = app.get<PostgresDatabase>(DATABASE);

    // --- Helper to register, verify, and login a user ---
    async function createUser(emailAddress: string): Promise<{ userId: string; cookie: string; csrf: string }> {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: emailAddress, password: 'a secure password' }).expect(201);
      const user = await identity.findUserByEmail(emailAddress);
      const actionUrl = email.messages.filter((m: any) => m.recipient === emailAddress).at(-1)?.actionUrl;
      const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
      await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);
      const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: emailAddress, password: 'a secure password' }).expect(200);
      const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
      const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
      const csrfToken = csrfCookie.split(';')[0]!.split('=')[1];
      return { userId: user!.id, cookie: `${sessionCookie}; ${csrfCookie}`, csrf: csrfToken };
    }

    // --- Helper to create a store ---
    async function createStore(authCookie: string, csrfToken: string, name: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Cookie', authCookie)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', `store-${name}-${Date.now()}`)
        .send({ name })
        .expect(201);
      return res.body.data.store.id;
    }

    // --- Helper to invite and accept ---
    async function inviteAndAccept(storeId: string, inviterCookie: string, inviterCsrf: string, inviteeEmail: string, roleCode: string): Promise<{ userId: string; cookie: string; csrf: string }> {
      await request(app.getHttpServer())
        .post(`/api/v1/stores/${storeId}/invitations`)
        .set('Cookie', inviterCookie)
        .set('x-csrf-token', inviterCsrf)
        .send({ email: inviteeEmail, roleCode })
        .expect(201);
      const invitee = await createUser(inviteeEmail);
      const actionUrl = email.messages.find((m: any) => m.recipient === inviteeEmail)?.actionUrl;
      const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
      await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Cookie', invitee.cookie)
        .set('x-csrf-token', invitee.csrf)
        .send({ token })
        .expect(201);
      return invitee;
    }

    // Create users and stores
    const ownerA = await createUser(`owner-a-${Date.now()}@example.com`);
    const ownerB = await createUser(`owner-b-${Date.now()}@example.com`);

    const storeA = await createStore(ownerA.cookie, ownerA.csrf, 'Store A');
    const storeB = await createStore(ownerB.cookie, ownerB.csrf, 'Store B');

    // Invite staff to Store A as STAFF
    const staffAMember = await inviteAndAccept(storeA, ownerA.cookie, ownerA.csrf, `staff-a-${Date.now()}@example.com`, 'STAFF');

    // 1. Store A user accessing Store B resource -> generic 403
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeB}/members`)
      .set('Cookie', ownerA.cookie)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('STORE_ACCESS_DENIED');
      });

    // 2. Missing membership -> generic 403
    const stranger = await createUser(`stranger-${Date.now()}@example.com`);
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeA}/members`)
      .set('Cookie', stranger.cookie)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('STORE_ACCESS_DENIED');
      });

    // 3. Suspended membership -> generic 403
    const suspendedUser = await inviteAndAccept(storeA, ownerA.cookie, ownerA.csrf, `suspended-${Date.now()}@example.com`, 'STAFF');
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeA}/members/${suspendedUser.userId}/suspend`)
      .set('Cookie', ownerA.cookie)
      .set('x-csrf-token', ownerA.csrf)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeA}/members`)
      .set('Cookie', suspendedUser.cookie)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('STORE_ACCESS_DENIED');
      });

    // 4. Deactivated Store -> generic 403
    await database.query("UPDATE stores SET status = 'DEACTIVATED' WHERE id = $1", [storeB]);
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeB}/members`)
      .set('Cookie', ownerB.cookie)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('STORE_ACCESS_DENIED');
      });

    // 5. Revoked permission: Staff trying to manage members -> 403
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeA}/members/${suspendedUser.userId}/suspend`)
      .set('Cookie', staffAMember.cookie)
      .set('x-csrf-token', staffAMember.csrf)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('PERMISSION_DENIED');
      });

    // 6. Last-Owner protection -> 409
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeA}/members/${ownerA.userId}/role`)
      .set('Cookie', ownerA.cookie)
      .set('x-csrf-token', ownerA.csrf)
      .send({ roleCode: 'ADMIN' })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('FINAL_OWNER_PROTECTED');
      });

    // 7. Capabilities endpoint returns only current store permissions
    const ownerSelectRes = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeA}/select`)
      .set('Cookie', ownerA.cookie)
      .set('x-csrf-token', ownerA.csrf)
      .expect(200);
    const ownerSelectedStoreCookie = ownerSelectRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_selected_store='));
    const ownerAFullCookie = `${ownerA.cookie}; ${ownerSelectedStoreCookie}`;
    const caps = await request(app.getHttpServer())
      .get('/api/v1/capabilities')
      .set('Cookie', ownerAFullCookie)
      .expect(200);
    expect(caps.body.data.permissions).toContain('store.deactivate');
    expect(caps.body.data).not.toHaveProperty('role');

    // Staff capabilities for Store A
    const staffSelectRes = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeA}/select`)
      .set('Cookie', staffAMember.cookie)
      .set('x-csrf-token', staffAMember.csrf)
      .expect(200);
    const staffSelectedStoreCookie = staffSelectRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_selected_store='));
    const staffAFullCookie = `${staffAMember.cookie}; ${staffSelectedStoreCookie}`;
    const staffCaps = await request(app.getHttpServer())
      .get('/api/v1/capabilities')
      .set('Cookie', staffAFullCookie)
      .expect(200);
    expect(staffCaps.body.data.permissions).toEqual(expect.arrayContaining(['dashboard.read', 'orders.read']));
    expect(staffCaps.body.data.permissions).not.toContain('store.settings');
    expect(staffCaps.body.data).not.toHaveProperty('role');

    await app.close();
  });
});

describe('CSRF protection', () => {
  it('rejects cookie-authenticated mutations without a valid CSRF token', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    const address = `csrf-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);

    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: address, password: 'a secure password' }).expect(200);
    const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));

    // Mutation without CSRF header -> 403
    await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', sessionCookie)
      .send({ name: 'No CSRF Store' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('CSRF_ERROR');
      });

    // Mutation with wrong CSRF token -> 403
    await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', sessionCookie)
      .set('x-csrf-token', 'wrong-token')
      .send({ name: 'Wrong CSRF Store' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('CSRF_ERROR');
      });

    // Safe method (GET) works without CSRF token
    await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Cookie', sessionCookie)
      .expect(200);

    await app.close();
  });
});

describe('Brute force protection', () => {
  it('rate-limits login after 5 failed attempts', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const address = `brute-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: address, password: 'wrong password' })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.code).toBe('UNAUTHENTICATED');
        });
    }

    // 5th attempt should be rate-limited
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password: 'wrong password' })
      .expect(429)
      .expect((res) => {
        expect(res.body.error.code).toBe('RATE_LIMITED');
      });

    // Even correct password is rejected while locked
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password: 'a secure password' })
      .expect(429)
      .expect((res) => {
        expect(res.body.error.code).toBe('RATE_LIMITED');
      });

    await app.close();
  });
});

describe('Account enumeration resistance', () => {
  it('returns identical generic responses for invalid email and invalid password', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const address = `enum-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);

    const invalidEmailRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `nonexistent-${Date.now()}@example.com`, password: 'a secure password' });

    const invalidPasswordRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password: 'wrong password' });

    expect(invalidEmailRes.status).toBe(401);
    expect(invalidPasswordRes.status).toBe(401);
    expect(invalidEmailRes.body.error.code).toBe('UNAUTHENTICATED');
    expect(invalidEmailRes.body.error.message).toBe(invalidPasswordRes.body.error.message);

    // Password reset request also returns generic response
    const resetNonExistent = await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset-request')
      .send({ email: `nonexistent-${Date.now()}@example.com` });

    const resetExisting = await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset-request')
      .send({ email: address });

    expect(resetNonExistent.status).toBe(200);
    expect(resetExisting.status).toBe(200);
    expect(resetNonExistent.body).toEqual(resetExisting.body);
    expect(resetNonExistent.body.data).toEqual({ accepted: true });

    await app.close();
  });
});

describe('Token replay protection', () => {
  it('rejects reused password-reset tokens', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const address = `replay-${Date.now()}@example.com`;
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

    // First reset succeeds
    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset')
      .send({ token: resetToken, password: 'another secure password' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.accepted).toBe(true);
      });

    // Reuse same token -> rejected
    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset')
      .send({ token: resetToken, password: 'yet another password' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.accepted).toBe(false);
      });

    await app.close();
  });
});

describe('Duplicate invitation acceptance', () => {
  it('rejects accepting an already-consumed invitation', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);

    // Create owner and store
    const ownerAddress = `dup-owner-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: ownerAddress, password: 'a secure password' }).expect(201);
    const ownerVerifyUrl = email.messages.filter((m: any) => m.recipient === ownerAddress).at(-1)?.actionUrl;
    const ownerVerifyToken = new URL(`http://localhost${ownerVerifyUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: ownerVerifyToken }).expect(200);

    const ownerLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: ownerAddress, password: 'a secure password' }).expect(200);
    const ownerSessionCookie = ownerLogin.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const ownerCsrfCookie = ownerLogin.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    const ownerCsrf = ownerCsrfCookie.split(';')[0]!.split('=')[1];
    const ownerCookie = `${ownerSessionCookie}; ${ownerCsrfCookie}`;

    const storeRes = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', ownerCsrf)
      .set('idempotency-key', `dup-store-${Date.now()}`)
      .send({ name: 'Dup Store' })
      .expect(201);
    const storeId = storeRes.body.data.store.id;

    // Invite a new user
    const inviteeAddress = `dup-invitee-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/invitations`)
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', ownerCsrf)
      .send({ email: inviteeAddress, roleCode: 'STAFF' })
      .expect(201);

    // Create and login invitee
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: inviteeAddress, password: 'a secure password' }).expect(201);
    const inviteeVerifyUrl = email.messages.filter((m: any) => m.recipient === inviteeAddress).at(-1)?.actionUrl;
    const inviteeVerifyToken = new URL(`http://localhost${inviteeVerifyUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: inviteeVerifyToken }).expect(200);

    const inviteeLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: inviteeAddress, password: 'a secure password' }).expect(200);
    const inviteeSessionCookie = inviteeLogin.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const inviteeCsrfCookie = inviteeLogin.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    const inviteeCsrf = inviteeCsrfCookie.split(';')[0]!.split('=')[1];
    const inviteeCookie = `${inviteeSessionCookie}; ${inviteeCsrfCookie}`;

    const inviteActionUrl = email.messages.find((m: any) => m.recipient === inviteeAddress)?.actionUrl;
    const inviteToken = new URL(`http://localhost${inviteActionUrl}`).searchParams.get('token')!;

    // First acceptance succeeds
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Cookie', inviteeCookie)
      .set('x-csrf-token', inviteeCsrf)
      .send({ token: inviteToken })
      .expect(201);

    // Duplicate acceptance fails
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Cookie', inviteeCookie)
      .set('x-csrf-token', inviteeCsrf)
      .send({ token: inviteToken })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('INVITATION_INVALID');
      });

    await app.close();
  });
});

describe('Deactivated user access control', () => {
  it('rejects authentication for disabled users', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const email = app.get<MemoryEmailDelivery>(EMAIL_DELIVERY);
    const identity = app.get<IdentityStore>(IDENTITY_REPOSITORY);
    const database = app.get<PostgresDatabase>(DATABASE);

    const address = `disabled-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password: 'a secure password' }).expect(201);
    const actionUrl = email.messages[0]!.actionUrl;
    const token = new URL(`http://localhost${actionUrl}`).searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token }).expect(200);

    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: address, password: 'a secure password' }).expect(200);
    const sessionCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('commerce_session='));
    const csrfCookie = loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('csrf_token='));
    const authCookie = `${sessionCookie}; ${csrfCookie}`;

    // Disable user directly in database
    const user = await identity.findUserByEmail(address);
    await database.query("UPDATE users SET status = 'DISABLED' WHERE id = $1", [user!.id]);

    // Existing session should be rejected
    await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Cookie', authCookie)
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      });

    // New login should also be rejected
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password: 'a secure password' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      });

    await app.close();
  });
});

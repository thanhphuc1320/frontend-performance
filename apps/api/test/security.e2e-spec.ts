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
      .expect(201);
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

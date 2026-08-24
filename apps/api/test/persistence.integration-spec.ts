import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { IdentityRepository } from '../src/identity/infrastructure/identity.repository';
import { SessionRepository } from '../src/auth/infrastructure/session.repository';
import { StoreRepository } from '../src/stores/infrastructure/store.repository';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:commerce_local@127.0.0.1:55432/commerce';

describe('Auth/Store/RBAC persistence', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE invitations, store_memberships, stores, email_tokens, sessions, users CASCADE');
  });

  it('creates the required schema and fixed role catalog', async () => {
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename");
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      'email_tokens', 'invitations', 'permissions', 'role_permissions', 'roles', 'sessions', 'store_memberships', 'stores', 'users',
    ]);

    const roles = await client.query('SELECT code FROM roles ORDER BY code');
    expect(roles.rows.map((row) => row.code)).toEqual(['ADMIN', 'ANALYST', 'CUSTOMER_SUPPORT', 'OWNER', 'STAFF', 'WAREHOUSE']);

    const permissions = await client.query('SELECT code FROM permissions ORDER BY code');
    expect(permissions.rowCount).toBe(25);
  });

  it('enforces global emails, scoped membership uniqueness, and token hash uniqueness', async () => {
    const userId = randomUUID();
    await client.query(
      'INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3)',
      [userId, 'person@example.com', 'hash'],
    );
    await expect(client.query(
      'INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3)',
      [randomUUID(), 'person@example.com', 'hash'],
    )).rejects.toMatchObject({ code: '23505' });

    const storeId = randomUUID();
    await client.query(
      'INSERT INTO stores (id, name, created_by) VALUES ($1, $2, $3)',
      [storeId, 'Store', userId],
    );
    await client.query(
      'INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = $3',
      [storeId, userId, 'OWNER'],
    );
    await expect(client.query(
      'INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = $3',
      [storeId, userId, 'ADMIN'],
    )).rejects.toMatchObject({ code: '23505' });

    const tokenHash = createHash('sha256').update('token').digest('hex');
    await client.query(
      'INSERT INTO email_tokens (user_id, token_type, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval \'1 hour\')',
      [userId, 'VERIFICATION', tokenHash],
    );
    await expect(client.query(
      'INSERT INTO email_tokens (user_id, token_type, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval \'1 hour\')',
      [userId, 'PASSWORD_RESET', tokenHash],
    )).rejects.toMatchObject({ code: '23505' });
  });

  it('persists expiry and consumption state for sessions, tokens, and invitations', async () => {
    const userId = randomUUID();
    const storeId = randomUUID();
    await client.query('INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3)', [userId, 'invitee@example.com', 'hash']);
    await client.query('INSERT INTO stores (id, name, created_by) VALUES ($1, $2, $3)', [storeId, 'Store', userId]);
    await client.query('INSERT INTO sessions (user_id, session_hash, idle_expires_at, absolute_expires_at) VALUES ($1, $2, now() + interval \'1 hour\', now() + interval \'1 day\')', [userId, 'a'.repeat(64)]);
    await client.query('INSERT INTO invitations (store_id, inviter_user_id, email_normalized, role_id, token_hash, expires_at) SELECT $1, $2, $3, id, $4, now() + interval \'7 days\' FROM roles WHERE code = \'STAFF\'', [storeId, userId, 'invitee@example.com', 'b'.repeat(64)]);

    const state = await client.query('SELECT idle_expires_at, absolute_expires_at, revoked_at FROM sessions WHERE session_hash = $1', ['a'.repeat(64)]);
    expect(state.rows[0].idle_expires_at).toBeTruthy();
    expect(state.rows[0].absolute_expires_at).toBeTruthy();
    expect(state.rows[0].revoked_at).toBeNull();
    const invitation = await client.query('SELECT expires_at, consumed_at, revoked_at FROM invitations WHERE token_hash = $1', ['b'.repeat(64)]);
    expect(invitation.rows[0].expires_at).toBeTruthy();
    expect(invitation.rows[0].consumed_at).toBeNull();
    expect(invitation.rows[0].revoked_at).toBeNull();
  });

  it('exposes parameterized identity, session, and Store repository operations', async () => {
    const userId = randomUUID();
    const storeId = randomUUID();
    const identity = new IdentityRepository(client);
    const sessions = new SessionRepository(client);
    const stores = new StoreRepository(client);

    const user = await identity.createUser({ id: userId, email: 'repository@example.com', passwordHash: 'hash' });
    expect(user.email).toBe('repository@example.com');
    await stores.createStore({ id: storeId, name: 'Repository Store', createdBy: userId });
    const membership = await stores.createMembership({ id: randomUUID(), storeId, userId, roleCode: 'OWNER' });
    expect(membership.roleCode).toBe('OWNER');
    expect((await stores.findMembership(storeId, userId))?.status).toBe('ACTIVE');

    const session = await sessions.create({
      id: randomUUID(), userId, sessionHash: 'c'.repeat(64), lastActivityAt: new Date(),
      idleExpiresAt: new Date(Date.now() + 3_600_000), absoluteExpiresAt: new Date(Date.now() + 86_400_000),
    });
    expect((await sessions.findByHash(session.sessionHash))?.userId).toBe(userId);
    expect(await sessions.revoke(session.id)).toBe(true);
    expect(await sessions.findByHash(session.sessionHash)).toBeNull();
  });
});

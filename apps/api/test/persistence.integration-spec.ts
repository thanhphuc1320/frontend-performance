import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { AuthTokenType } from '../src/identity/domain/auth-token';
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
    await client.query('TRUNCATE audit_logs, invitations, store_memberships, stores, email_tokens, sessions, users CASCADE');
  });

  it('creates the required schema and fixed role catalog', async () => {
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename");
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      'audit_logs', 'email_tokens', 'invitations', 'permissions', 'role_permissions', 'roles', 'sessions', 'store_memberships', 'stores', 'users',
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

  it('protects the final Owner from every downgrade, status transition, and delete', async () => {
    const userId = randomUUID();
    const storeId = randomUUID();
    await client.query('INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3)', [userId, 'owner@example.com', 'hash']);
    await client.query('INSERT INTO stores (id, name, created_by) VALUES ($1, $2, $3)', [storeId, 'Owner Store', userId]);
    await client.query('INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = \'OWNER\'', [storeId, userId]);

    for (const status of ['INVITED', 'SUSPENDED', 'LEFT', 'REMOVED']) {
      await expect(client.query('UPDATE store_memberships SET status = $1 WHERE store_id = $2', [status, storeId])).rejects.toMatchObject({ code: 'P0001' });
    }
    await expect(client.query("UPDATE store_memberships SET role_id = (SELECT id FROM roles WHERE code = 'ADMIN') WHERE store_id = $1", [storeId])).rejects.toMatchObject({ code: 'P0001' });
    await expect(client.query('DELETE FROM store_memberships WHERE store_id = $1', [storeId])).rejects.toMatchObject({ code: 'P0001' });
  });

  it('allows non-final member deletes and serializes concurrent Owner changes', async () => {
    const ownerA = randomUUID();
    const ownerB = randomUUID();
    const member = randomUUID();
    const storeId = randomUUID();
    await client.query('INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)', [ownerA, 'a@example.com', 'hash', ownerB, 'b@example.com', 'hash', member, 'member@example.com', 'hash']);
    await client.query('INSERT INTO stores (id, name, created_by) VALUES ($1, $2, $3)', [storeId, 'Concurrent Store', ownerA]);
    await client.query('INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = \'OWNER\'', [storeId, ownerA]);
    await client.query('INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = \'OWNER\'', [storeId, ownerB]);
    await client.query('INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = \'STAFF\'', [storeId, member]);
    const first = new Client({ connectionString: databaseUrl });
    const second = new Client({ connectionString: databaseUrl });
    await Promise.all([first.connect(), second.connect()]);
    try {
      await Promise.all([first.query('BEGIN'), second.query('BEGIN')]);
      await first.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [storeId]);
      const firstChange = first.query("UPDATE store_memberships SET role_id = (SELECT id FROM roles WHERE code = 'ADMIN') WHERE store_id = $1 AND user_id = $2", [storeId, ownerA]);
      const secondChange = second.query("UPDATE store_memberships SET role_id = (SELECT id FROM roles WHERE code = 'ADMIN') WHERE store_id = $1 AND user_id = $2", [storeId, ownerB]).then(
        () => null,
        (error: unknown) => error,
      );
      await firstChange;
      await first.query('COMMIT');
      await expect(secondChange).resolves.toMatchObject({ code: 'P0001' });
      await second.query('ROLLBACK');
    } finally {
      await Promise.all([first.end(), second.end()]);
    }

    await client.query('DELETE FROM store_memberships WHERE store_id = $1 AND user_id = $2', [storeId, member]);
    expect((await client.query('SELECT 1 FROM store_memberships WHERE store_id = $1 AND user_id = $2', [storeId, member])).rowCount).toBe(0);
  });

  it('rejects direct Store hard deletes', async () => {
    const userId = randomUUID();
    const storeId = randomUUID();
    await client.query('INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3)', [userId, 'delete@example.com', 'hash']);
    await client.query('INSERT INTO stores (id, name, created_by) VALUES ($1, $2, $3)', [storeId, 'Protected Store', userId]);
    await expect(client.query('DELETE FROM stores WHERE id = $1', [storeId])).rejects.toMatchObject({ code: 'P0001' });
    expect((await client.query('SELECT id FROM stores WHERE id = $1', [storeId])).rowCount).toBe(1);
  });

  it('maps missing roles and database conflicts to safe repository errors', async () => {
    const userId = randomUUID();
    const storeId = randomUUID();
    const identity = new IdentityRepository(client);
    const stores = new StoreRepository(client);
    const sessions = new SessionRepository(client);
    await identity.createUser({ id: userId, email: 'safe-errors@example.com', passwordHash: 'hash' });
    await expect(identity.createUser({ id: randomUUID(), email: 'safe-errors@example.com', passwordHash: 'hash' })).rejects.toMatchObject({ code: 'CONFLICT', message: 'User already exists' });
    await stores.createStore({ id: storeId, name: 'Safe Errors', createdBy: userId });
    await expect(stores.createMembership({ id: randomUUID(), storeId, userId, roleCode: 'NO_SUCH_ROLE' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Role not found' });
    await stores.createMembership({ id: randomUUID(), storeId, userId, roleCode: 'OWNER' });
    await expect(stores.createMembership({ id: randomUUID(), storeId, userId, roleCode: 'OWNER' })).rejects.toMatchObject({ code: 'CONFLICT', message: 'Membership already exists' });
    await sessions.create({ id: randomUUID(), userId, sessionHash: 'd'.repeat(64), lastActivityAt: new Date(), idleExpiresAt: new Date(Date.now() + 3600000), absoluteExpiresAt: new Date(Date.now() + 86400000) });
    await expect(sessions.create({ id: randomUUID(), userId, sessionHash: 'd'.repeat(64), lastActivityAt: new Date(), idleExpiresAt: new Date(Date.now() + 3600000), absoluteExpiresAt: new Date(Date.now() + 86400000) })).rejects.toMatchObject({ code: 'CONFLICT', message: 'Session already exists' });
    await identity.createToken({ id: randomUUID(), userId, type: AuthTokenType.VERIFICATION, hash: 'e'.repeat(64), expiresAt: new Date(Date.now() + 3600000) });
    await expect(identity.createToken({ id: randomUUID(), userId, type: AuthTokenType.PASSWORD_RESET, hash: 'e'.repeat(64), expiresAt: new Date(Date.now() + 3600000) })).rejects.toMatchObject({ code: 'CONFLICT', message: 'Token already exists' });
  });

  it('does not reconcile idempotency keys to inactive or non-Owner memberships', async () => {
    const userId = randomUUID();
    const storeId = randomUUID();
    const secondUserId = randomUUID();
    await client.query('INSERT INTO users (id, email_normalized, password_hash, status) VALUES ($1, $2, $3, \'ACTIVE\'), ($4, $5, $6, \'ACTIVE\')', [userId, 'reconcile@example.com', 'hash', secondUserId, 'reconcile-two@example.com', 'hash']);
    await client.query('INSERT INTO stores (id, name, created_by, status, onboarding_idempotency_key) VALUES ($1, $2, $3, \'DEACTIVATED\', $4)', [storeId, 'Inactive', userId, 'retry-key']);
    await client.query('INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = \'OWNER\'', [storeId, userId]);
    const stores = new StoreRepository(client);

    await expect(stores.findByIdempotencyKey(userId, 'retry-key')).resolves.toBeNull();
    await client.query('UPDATE stores SET status = \'ACTIVE\' WHERE id = $1', [storeId]);
    await client.query('INSERT INTO store_memberships (store_id, user_id, role_id) SELECT $1, $2, id FROM roles WHERE code = \'OWNER\'', [storeId, secondUserId]);
    await client.query('UPDATE store_memberships SET role_id = (SELECT id FROM roles WHERE code = \'STAFF\') WHERE store_id = $1 AND user_id = $2', [storeId, userId]);
    await expect(stores.findByIdempotencyKey(userId, 'retry-key')).resolves.toBeNull();
  });
});

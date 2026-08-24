type Database = { query<T>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
import { RepositoryError, mapConflict } from '../../persistence/repository-error';
export type StoreStatus = 'ACTIVE' | 'DEACTIVATED';
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT' | 'REMOVED';
export type StoreRecord = { id: string; name: string; timezone: string; currency: string; status: StoreStatus; createdBy: string };
export type MembershipRecord = { id: string; storeId: string; userId: string; roleCode: string; status: MembershipStatus };
export type InvitationRecord = { id: string; storeId: string; email: string; roleCode: string; tokenHash: string; status: string; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null };
type StoreRow = { id: string; name: string; timezone: string; currency: string; status: StoreStatus; created_by: string };
type MembershipRow = { id: string; store_id: string; user_id: string; role_code: string; status: MembershipStatus };
type InvitationRow = { id: string; store_id: string; email: string; role_code: string; token_hash: string; status: string; expires_at: Date; consumed_at: Date | null; revoked_at: Date | null };

export class StoreRepository {
  constructor(private readonly database: Database) {}

  async transaction<T>(work: (executor: Database) => Promise<T>): Promise<T> {
    await this.database.query('BEGIN');
    try {
      const result = await work(this.database);
      await this.database.query('COMMIT');
      return result;
    } catch (error) {
      await this.database.query('ROLLBACK');
      throw error;
    }
  }

  async createStore(input: { id: string; name: string; timezone?: string; currency?: string; createdBy: string }, executor: Database = this.database): Promise<StoreRecord> {
    try {
      const result = await executor.query<StoreRow>(
        `INSERT INTO stores (id, name, timezone, currency, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, timezone, currency, status, created_by`,
        [input.id, input.name, input.timezone ?? 'Asia/Ho_Chi_Minh', input.currency ?? 'VND', input.createdBy],
      );
      const row = result.rows[0]!;
      return { ...row, createdBy: row.created_by };
    } catch (error) {
      return mapConflict(error, 'Store already exists');
    }
  }

  async listForUser(userId: string): Promise<StoreRecord[]> {
    const result = await this.database.query<StoreRow>(
      `SELECT s.id, s.name, s.timezone, s.currency, s.status, s.created_by FROM stores s
       JOIN store_memberships m ON m.store_id = s.id WHERE m.user_id = $1 AND m.status = 'ACTIVE' ORDER BY s.created_at, s.id`, [userId],
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name, timezone: row.timezone, currency: row.currency, status: row.status, createdBy: row.created_by }));
  }

  async createMembership(input: { id: string; storeId: string; userId: string; roleCode: string; status?: MembershipStatus }, executor: Database = this.database): Promise<MembershipRecord> {
    let result;
    try {
      result = await executor.query<MembershipRow>(
        `INSERT INTO store_memberships (id, store_id, user_id, role_id, status) SELECT $1, $2, $3, id, $5 FROM roles WHERE code = $4
         RETURNING id, store_id, user_id, status, (SELECT code FROM roles WHERE id = role_id) AS role_code`,
        [input.id, input.storeId, input.userId, input.roleCode, input.status ?? 'ACTIVE'],
      );
    } catch (error) {
      return mapConflict(error, 'Membership already exists');
    }
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Role not found');
    const row = result.rows[0]!;
    return { id: row.id, storeId: row.store_id, userId: row.user_id, roleCode: row.role_code, status: row.status };
  }

  async findMembership(storeId: string, userId: string): Promise<MembershipRecord | null> {
    const result = await this.database.query<MembershipRow>(
      `SELECT m.id, m.store_id, m.user_id, m.status, r.code AS role_code FROM store_memberships m JOIN roles r ON r.id = m.role_id WHERE m.store_id = $1 AND m.user_id = $2`, [storeId, userId],
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0]!;
    return { id: row.id, storeId: row.store_id, userId: row.user_id, roleCode: row.role_code, status: row.status };
  }

  async createInvitation(input: { id: string; storeId: string; inviterUserId: string; email: string; roleCode: string; tokenHash: string; expiresAt: Date }): Promise<InvitationRecord> {
    let result;
    try {
      result = await this.database.query<InvitationRow>(
        `INSERT INTO invitations (id, store_id, inviter_user_id, email_normalized, role_id, token_hash, expires_at)
         SELECT $1, $2, $3, $4, id, $5, $6 FROM roles WHERE code = $7 RETURNING id, store_id, email_normalized AS email, token_hash, status, expires_at, consumed_at, revoked_at, (SELECT code FROM roles WHERE id = role_id) AS role_code`,
        [input.id, input.storeId, input.inviterUserId, input.email, input.tokenHash, input.expiresAt, input.roleCode],
      );
    } catch (error) {
      return mapConflict(error, 'Invitation already exists');
    }
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Role not found');
    const row = result.rows[0]!;
    return { id: row.id, storeId: row.store_id, email: row.email, roleCode: row.role_code, tokenHash: row.token_hash, status: row.status, expiresAt: row.expires_at, consumedAt: row.consumed_at, revokedAt: row.revoked_at };
  }

  async consumeInvitation(tokenHash: string): Promise<boolean> {
    const result = await this.database.query(`UPDATE invitations SET status = 'ACCEPTED', consumed_at = now() WHERE token_hash = $1 AND status = 'PENDING' AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, [tokenHash]);
    return result.rowCount === 1;
  }
}

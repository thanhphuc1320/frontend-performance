type Database = { query<T>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
import { mapConflict } from '../../persistence/repository-error';
export type SessionRecord = {
  id: string;
  userId: string;
  sessionHash: string;
  lastActivityAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};
type SessionRow = { id: string; user_id: string; session_hash: string; last_activity_at: Date; idle_expires_at: Date; absolute_expires_at: Date; revoked_at: Date | null };

function toSession(row: SessionRow): SessionRecord {
  return { id: row.id, userId: row.user_id, sessionHash: row.session_hash, lastActivityAt: row.last_activity_at, idleExpiresAt: row.idle_expires_at, absoluteExpiresAt: row.absolute_expires_at, revokedAt: row.revoked_at };
}

export class SessionRepository {
  constructor(private readonly database: Database) {}

  async create(input: Omit<SessionRecord, 'revokedAt'> & { userAgent?: string; ipAddress?: string }): Promise<SessionRecord> {
    try {
      const result = await this.database.query<SessionRow>(
        `INSERT INTO sessions (id, user_id, session_hash, last_activity_at, idle_expires_at, absolute_expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [input.id, input.userId, input.sessionHash, input.lastActivityAt, input.idleExpiresAt, input.absoluteExpiresAt, input.userAgent ?? null, input.ipAddress ?? null],
      );
      return toSession(result.rows[0]!);
    } catch (error) {
      return mapConflict(error, 'Session already exists');
    }
  }

  async findByHash(sessionHash: string): Promise<SessionRecord | null> {
    const result = await this.database.query<SessionRow>('SELECT * FROM sessions WHERE session_hash = $1 AND revoked_at IS NULL AND idle_expires_at > now() AND absolute_expires_at > now()', [sessionHash]);
    return result.rowCount === 0 ? null : toSession(result.rows[0]!);
  }

  async touch(id: string, idleExpiresAt: Date): Promise<boolean> {
    const result = await this.database.query('UPDATE sessions SET last_activity_at = now(), idle_expires_at = LEAST($2, absolute_expires_at) WHERE id = $1 AND revoked_at IS NULL AND absolute_expires_at > now()', [id, idleExpiresAt]);
    return result.rowCount === 1;
  }

  async revoke(id: string): Promise<boolean> {
    const result = await this.database.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
    return result.rowCount === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.database.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  }
}

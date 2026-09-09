import { AuthToken, AuthTokenType } from '../domain/auth-token';
import { User, UserStatus } from '../domain/user';
import { mapConflict } from '../../persistence/repository-error';

type QueryResult<T> = { rows: T[]; rowCount: number | null };
type Executor = { query<T>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> };
type Database = Executor & { acquire?: () => Promise<Executor & { release(): void }> };
type UserRow = { id: string; email_normalized: string; password_hash: string; status: UserStatus; lock_until: Date | null; failed_login_attempts: number };

function toUser(row: UserRow): User {
  return new User(row.id, row.email_normalized, row.password_hash, row.status, row.lock_until ?? undefined, row.failed_login_attempts);
}

export class IdentityRepository {
  constructor(private readonly database: Database) {}

  async transaction<T>(work: (executor: Executor) => Promise<T>): Promise<T> {
    if (this.database.acquire) {
      const connection = await this.database.acquire();
      await connection.query('BEGIN');
      try {
        const result = await work(connection);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    }
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

  async createUser(input: { id: string; email: string; passwordHash: string }, executor: Executor = this.database): Promise<User> {
    try {
      const result = await executor.query<UserRow>(
        `INSERT INTO users (id, email_normalized, password_hash) VALUES ($1, $2, $3)
         RETURNING id, email_normalized, password_hash, status, lock_until, failed_login_attempts`,
        [input.id, input.email, input.passwordHash],
      );
      return toUser(result.rows[0]!);
    } catch (error) {
      return mapConflict(error, 'User already exists');
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.database.query<UserRow>(
      'SELECT id, email_normalized, password_hash, status, lock_until, failed_login_attempts FROM users WHERE email_normalized = $1', [email],
    );
    return result.rowCount === 0 ? null : toUser(result.rows[0]!);
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.database.query<UserRow>(
      'SELECT id, email_normalized, password_hash, status, lock_until, failed_login_attempts FROM users WHERE id = $1', [id],
    );
    return result.rowCount === 0 ? null : toUser(result.rows[0]!);
  }

  async updateUser(user: User, executor: Executor = this.database): Promise<void> {
    await executor.query(
      `UPDATE users SET status = $2, password_hash = $3, lock_until = $4, failed_login_attempts = $5, email_verified_at = CASE WHEN $2 = 'ACTIVE' THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END, updated_at = now() WHERE id = $1`,
      [user.id, user.status, user.passwordHash, user.lockUntil, user.failedLoginAttempts],
    );
  }

  async updateEmail(userId: string, email: string, executor: Executor = this.database): Promise<void> {
    await executor.query(
      `UPDATE users SET email_normalized = $2, updated_at = now() WHERE id = $1`,
      [userId, email],
    );
  }

  async createToken(input: { id: string; userId: string; type: AuthTokenType; hash: string; expiresAt: Date; email?: string }, executor: Executor = this.database): Promise<AuthToken> {
    try {
      const result = await executor.query<{ token_hash: string; expires_at: Date }>(
        `INSERT INTO email_tokens (id, user_id, token_type, token_hash, expires_at, email_normalized)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING token_hash, expires_at`,
        [input.id, input.userId, input.type, input.hash, input.expiresAt, input.email ?? null],
      );
      return new AuthToken(input.type, result.rows[0]!.token_hash, result.rows[0]!.expires_at);
    } catch (error) {
      return mapConflict(error, 'Token already exists');
    }
  }

  async findToken(hash: string, type: AuthTokenType, executor: Executor = this.database): Promise<AuthToken | null> {
    const result = await executor.query<{ user_id: string; token_hash: string; expires_at: Date; consumed_at: Date | null; revoked_at: Date | null; email_normalized: string | null }>(
       `SELECT user_id, token_hash, expires_at, consumed_at, revoked_at, email_normalized FROM email_tokens
        WHERE token_hash = $1 AND token_type = $2 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, [hash, type],
    );
    if (result.rowCount === 0) return null;
     return Object.assign(new AuthToken(type, result.rows[0]!.token_hash, result.rows[0]!.expires_at), { userId: result.rows[0]!.user_id, email: result.rows[0]!.email_normalized ?? undefined });
  }

  async consumeToken(hash: string, executor: Executor = this.database): Promise<boolean> {
    const result = await executor.query(
      `UPDATE email_tokens SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, [hash],
    );
    return result.rowCount === 1;
  }

  async revokeTokens(userId: string, type?: AuthTokenType): Promise<void> {
    await this.database.query(
      `UPDATE email_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL${type ? ' AND token_type = $2' : ''}`,
      type ? [userId, type] : [userId],
    );
  }
}

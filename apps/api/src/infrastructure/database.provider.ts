import { Pool, type PoolClient } from 'pg';

export const DATABASE = Symbol('DATABASE');

export class PostgresDatabase {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:commerce_local@127.0.0.1:55432/commerce' });

  query<T>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, values as unknown[]);
  }

  async acquire(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}

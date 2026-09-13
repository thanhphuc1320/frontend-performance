import { Pool, type PoolClient } from 'pg';

export const DATABASE = Symbol('DATABASE');

export class PostgresDatabase {
  private readonly pool: Pool;

  constructor(connectionString = 'postgresql://postgres:commerce_local@127.0.0.1:55432/commerce') {
    this.pool = new Pool({ connectionString });
  }

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

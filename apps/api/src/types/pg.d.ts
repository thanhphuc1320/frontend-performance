declare module 'pg' {
  export type QueryResult<T> = { rows: T[]; rowCount: number | null };
  export type QueryValues = readonly unknown[];
  export class PoolClient {
    query<T>(text: string, values?: QueryValues): Promise<QueryResult<T>>;
    release(): void;
  }
  export class Pool {
    constructor(options?: { connectionString?: string });
    query<T>(text: string, values?: QueryValues): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
  const pg: { Pool: typeof Pool };
  export default pg;
}

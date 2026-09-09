type Database = { query<T>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };

export type AuditRecord = {
  id: string;
  actorUserId?: string;
  storeId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  timestamp: Date;
  requestId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
};

export class AuditRepository {
  constructor(private readonly database: Database) {}

  async insert(record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<AuditRecord> {
    const result = await this.database.query<{
      id: string;
      actor_user_id: string | null;
      store_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      timestamp: Date;
      request_id: string | null;
      before_data: Record<string, unknown> | null;
      after_data: Record<string, unknown> | null;
    }>(
      `INSERT INTO audit_logs (actor_user_id, store_id, action, resource_type, resource_id, request_id, before_data, after_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, actor_user_id, store_id, action, resource_type, resource_id, timestamp, request_id, before_data, after_data`,
      [
        record.actorUserId ?? null,
        record.storeId ?? null,
        record.action,
        record.resourceType,
        record.resourceId ?? null,
        record.requestId ?? null,
        record.beforeData ? JSON.stringify(record.beforeData) : null,
        record.afterData ? JSON.stringify(record.afterData) : null,
      ],
    );
    const row = result.rows[0]!;
    return {
      id: row.id,
      actorUserId: row.actor_user_id ?? undefined,
      storeId: row.store_id ?? undefined,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id ?? undefined,
      timestamp: row.timestamp,
      requestId: row.request_id ?? undefined,
      beforeData: row.before_data ?? undefined,
      afterData: row.after_data ?? undefined,
    };
  }
}

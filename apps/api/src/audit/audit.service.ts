export type AuditEvent = {
  actorUserId?: string;
  storeId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
};

export type AuditRepository = {
  insert(record: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<unknown>;
};

const FORBIDDEN_KEYS = ['password', 'token', 'hash', 'cookie', 'csrf', 'secret', 'rawtoken'];

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
    if (FORBIDDEN_KEYS.some((f) => lowerKey.includes(f))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async log(event: AuditEvent): Promise<void> {
    const safeEvent: AuditEvent = {
      ...event,
      beforeData: event.beforeData ? sanitize(event.beforeData) : undefined,
      afterData: event.afterData ? sanitize(event.afterData) : undefined,
    };
    await this.repository.insert(safeEvent);
  }
}

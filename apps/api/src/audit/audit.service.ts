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

function isForbiddenKey(key: string): boolean {
  const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
  return FORBIDDEN_KEYS.some((f) => lowerKey.includes(f));
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  return value;
}

function sanitizeObject(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isForbiddenKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeValue(value);
    }
  }
  return result;
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async log(event: AuditEvent): Promise<void> {
    const safeEvent: AuditEvent = {
      ...event,
      beforeData: event.beforeData ? sanitizeObject(event.beforeData) : undefined,
      afterData: event.afterData ? sanitizeObject(event.afterData) : undefined,
    };
    await this.repository.insert(safeEvent);
  }
}

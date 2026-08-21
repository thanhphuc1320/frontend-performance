export type ApiConfig = {
  NODE_ENV: 'development' | 'test' | 'production';
  API_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  SESSION_COOKIE_NAME: string;
  CORS_ORIGIN: string;
};

type Environment = Record<string, string | undefined>;

const PLACEHOLDER_VALUES = new Set(['change-me', 'changeme', 'example', 'placeholder', 'secret']);

export class ConfigValidationError extends Error {
  constructor(fields: string[]) {
    super(`Invalid environment configuration: ${fields.join(', ')}`);
    this.name = 'ConfigValidationError';
  }
}

export function loadApiConfig(env: Environment): ApiConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const port = env.API_PORT ?? '4000';
  const databaseUrl = env.DATABASE_URL;
  const redisUrl = env.REDIS_URL;
  const sessionCookieName = env.SESSION_COOKIE_NAME ?? 'commerce_session';
  const corsOrigin = env.CORS_ORIGIN ?? 'http://localhost:3000';
  const invalidFields: string[] = [];

  if (!['development', 'test', 'production'].includes(nodeEnv)) invalidFields.push('NODE_ENV');
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) invalidFields.push('API_PORT');
  if (!databaseUrl || !isUrl(databaseUrl, ['postgres:', 'postgresql:'])) invalidFields.push('DATABASE_URL');
  if (!redisUrl || !isUrl(redisUrl, ['redis:', 'rediss:'])) invalidFields.push('REDIS_URL');
  if (!sessionCookieName.trim()) invalidFields.push('SESSION_COOKIE_NAME');
  if (!isUrl(corsOrigin)) invalidFields.push('CORS_ORIGIN');
  if (nodeEnv === 'production' && PLACEHOLDER_VALUES.has(sessionCookieName.toLowerCase())) {
    invalidFields.push('SESSION_COOKIE_NAME');
  }

  if (invalidFields.length > 0) throw new ConfigValidationError([...new Set(invalidFields)]);

  return {
    NODE_ENV: nodeEnv as ApiConfig['NODE_ENV'],
    API_PORT: Number(port),
    DATABASE_URL: databaseUrl!,
    REDIS_URL: redisUrl!,
    SESSION_COOKIE_NAME: sessionCookieName,
    CORS_ORIGIN: corsOrigin,
  };
}

function isUrl(value: string, protocols?: string[]): boolean {
  try {
    const url = new URL(value);
    return protocols ? protocols.includes(url.protocol) : ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

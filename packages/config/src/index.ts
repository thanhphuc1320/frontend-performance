export type ApiConfig = {
  NODE_ENV: 'development' | 'test' | 'production';
  API_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  SESSION_COOKIE_NAME: string;
  CORS_ORIGIN: string;
  AUTH_LOCKOUT_MAX_ATTEMPTS?: number;
  AUTH_LOCKOUT_DURATION_SECONDS?: number;
  AUTH_VERIFICATION_TOKEN_TTL_SECONDS?: number;
  AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS?: number;
  AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS?: number;
  EMAIL_DELIVERY_MODE?: 'memory' | 'smtp';
  EMAIL_FROM?: string;
  SMTP_URL?: string;
  CSRF_SECRET?: string;
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
  const authFields = {
    AUTH_LOCKOUT_MAX_ATTEMPTS: parsePositiveInteger(env.AUTH_LOCKOUT_MAX_ATTEMPTS),
    AUTH_LOCKOUT_DURATION_SECONDS: parsePositiveInteger(env.AUTH_LOCKOUT_DURATION_SECONDS),
    AUTH_VERIFICATION_TOKEN_TTL_SECONDS: parsePositiveInteger(env.AUTH_VERIFICATION_TOKEN_TTL_SECONDS),
    AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: parsePositiveInteger(env.AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS),
    AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS: parsePositiveInteger(env.AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS),
  };
  const emailDeliveryMode = env.EMAIL_DELIVERY_MODE;
  const emailFrom = env.EMAIL_FROM;
  const smtpUrl = env.SMTP_URL;
  const csrfSecret = env.CSRF_SECRET;
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
  for (const [field, value] of Object.entries(authFields)) {
    if (env[field] !== undefined && value === undefined) invalidFields.push(field);
  }
  if (authFields.AUTH_LOCKOUT_MAX_ATTEMPTS !== undefined && authFields.AUTH_LOCKOUT_MAX_ATTEMPTS < 1) {
    invalidFields.push('AUTH_LOCKOUT_MAX_ATTEMPTS');
  }
  if (emailDeliveryMode !== undefined && !['memory', 'smtp'].includes(emailDeliveryMode)) {
    invalidFields.push('EMAIL_DELIVERY_MODE');
  }
  if (emailFrom !== undefined && !isEmail(emailFrom)) invalidFields.push('EMAIL_FROM');
  if (smtpUrl !== undefined && !isUrl(smtpUrl, ['smtp:', 'smtps:'])) invalidFields.push('SMTP_URL');
  if (csrfSecret !== undefined && csrfSecret.length < 32) invalidFields.push('CSRF_SECRET');
  if (csrfSecret !== undefined && PLACEHOLDER_VALUES.has(csrfSecret.toLowerCase())) invalidFields.push('CSRF_SECRET');
  if (nodeEnv === 'production') {
    for (const field of Object.keys(authFields)) {
      if (authFields[field as keyof typeof authFields] === undefined) invalidFields.push(field);
    }
    if (emailDeliveryMode !== 'smtp') invalidFields.push('EMAIL_DELIVERY_MODE');
    if (!emailFrom || !isEmail(emailFrom)) invalidFields.push('EMAIL_FROM');
    if (!smtpUrl || !isUrl(smtpUrl, ['smtp:', 'smtps:'])) invalidFields.push('SMTP_URL');
    if (!csrfSecret || csrfSecret.length < 32 || PLACEHOLDER_VALUES.has(csrfSecret.toLowerCase())) {
      invalidFields.push('CSRF_SECRET');
    }
  }

  if (invalidFields.length > 0) throw new ConfigValidationError([...new Set(invalidFields)]);

  const config: ApiConfig = {
    NODE_ENV: nodeEnv as ApiConfig['NODE_ENV'],
    API_PORT: Number(port),
    DATABASE_URL: databaseUrl!,
    REDIS_URL: redisUrl!,
    SESSION_COOKIE_NAME: sessionCookieName,
    CORS_ORIGIN: corsOrigin,
  };

  if (Object.values(authFields).some((value) => value !== undefined)) Object.assign(config, authFields);
  if (emailDeliveryMode !== undefined) config.EMAIL_DELIVERY_MODE = emailDeliveryMode as ApiConfig['EMAIL_DELIVERY_MODE'];
  if (emailFrom !== undefined) config.EMAIL_FROM = emailFrom;
  if (smtpUrl !== undefined) config.SMTP_URL = smtpUrl;
  if (csrfSecret !== undefined) config.CSRF_SECRET = csrfSecret;

  return config;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 && Number.isSafeInteger(parsed) ? parsed : undefined;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUrl(value: string, protocols?: string[]): boolean {
  try {
    const url = new URL(value);
    return protocols ? protocols.includes(url.protocol) : ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

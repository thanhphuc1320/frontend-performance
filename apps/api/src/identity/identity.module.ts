import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { IdentityRepository } from './infrastructure/identity.repository';
import { MemoryEmailDelivery } from './infrastructure/test-adapters';
import { Argon2idPasswordHasher, HibpPasswordChecker, SmtpEmailDelivery } from './infrastructure/production-adapters';
import { API_CONFIG, COMPROMISED_PASSWORD_CHECKER, EMAIL_DELIVERY, IDENTITY_REPOSITORY, PASSWORD_HASHER } from './application/identity.tokens';
import { loadApiConfig, type ApiConfig } from '@commerce/config';

function validatedConfig(): ApiConfig {
  const env = { ...process.env };
  if (!env.NODE_ENV) env.NODE_ENV = process.env.JEST_WORKER_ID ? 'test' : 'development';
  if (env.NODE_ENV !== 'production') {
    if (!env.DATABASE_URL) env.DATABASE_URL = 'postgresql://postgres:commerce_local@127.0.0.1:55432/commerce';
    if (!env.REDIS_URL) env.REDIS_URL = 'redis://:commerce_local@127.0.0.1:56379';
  }
  return loadApiConfig(env);
}

@Module({
  providers: [
    { provide: API_CONFIG, useFactory: validatedConfig },
    { provide: DATABASE, useFactory: (config: ApiConfig) => new PostgresDatabase(config.DATABASE_URL), inject: [API_CONFIG] },
    { provide: IDENTITY_REPOSITORY, useFactory: (database: PostgresDatabase) => new IdentityRepository(database), inject: [DATABASE] },
    { provide: EMAIL_DELIVERY, useFactory: (config: ApiConfig) => config.NODE_ENV === 'test' || config.EMAIL_DELIVERY_MODE === 'memory' ? new MemoryEmailDelivery() : new SmtpEmailDelivery(config), inject: [API_CONFIG] },
    { provide: PASSWORD_HASHER, useClass: Argon2idPasswordHasher },
    { provide: COMPROMISED_PASSWORD_CHECKER, useFactory: (config: ApiConfig) => config.NODE_ENV === 'test' ? { isCompromised: async () => false } : new HibpPasswordChecker(), inject: [API_CONFIG] },
    IdentityService,
  ],
  exports: [IdentityService, IDENTITY_REPOSITORY, DATABASE, EMAIL_DELIVERY, PASSWORD_HASHER, COMPROMISED_PASSWORD_CHECKER, API_CONFIG],
})
export class IdentityModule {}

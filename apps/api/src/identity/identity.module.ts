import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service';
import { AuthController } from '../auth/http/auth.controller';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { IdentityRepository } from './infrastructure/identity.repository';
import { MemoryEmailDelivery, TestPasswordHasher, noCompromisedPasswordChecker } from './infrastructure/test-adapters';
import { API_CONFIG, COMPROMISED_PASSWORD_CHECKER, EMAIL_DELIVERY, IDENTITY_REPOSITORY, PASSWORD_HASHER } from './application/identity.tokens';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: DATABASE, useClass: PostgresDatabase },
    { provide: IDENTITY_REPOSITORY, useFactory: (database: PostgresDatabase) => new IdentityRepository(database), inject: [DATABASE] },
    { provide: EMAIL_DELIVERY, useClass: MemoryEmailDelivery },
    { provide: PASSWORD_HASHER, useClass: TestPasswordHasher },
    { provide: COMPROMISED_PASSWORD_CHECKER, useValue: noCompromisedPasswordChecker },
    { provide: API_CONFIG, useValue: { AUTH_VERIFICATION_TOKEN_TTL_SECONDS: 86400 } },
    IdentityService,
  ],
  exports: [IdentityService, IDENTITY_REPOSITORY, DATABASE, EMAIL_DELIVERY],
})
export class IdentityModule {}

import { Module } from '@nestjs/common';
import { AuthController } from './http/auth.controller';
import { AuthGuard } from './http/auth.guard';
import { SessionService } from './application/session.service';
import { SessionRepository } from './infrastructure/session.repository';
import { IdentityModule } from '../identity/identity.module';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { API_CONFIG, EMAIL_DELIVERY, IDENTITY_REPOSITORY, PASSWORD_HASHER, SESSION_REVOKER } from '../identity/application/identity.tokens';
import type { PasswordHasher } from '../identity/application/ports/password-hasher';
import { SESSION_SERVICE } from './application/session.tokens';
import { IdentityRepository } from '../identity/infrastructure/identity.repository';
import { RecoveryService } from '../identity/application/recovery.service';

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [
    {
      provide: SESSION_SERVICE,
      useFactory: (database: PostgresDatabase, config: ReturnType<typeof import('@commerce/config').loadApiConfig>) => {
        const identityRepository = new IdentityRepository(database);
        const sessionRepository = new SessionRepository(database);
        return new SessionService(sessionRepository, identityRepository, config);
      },
      inject: [DATABASE, API_CONFIG],
    },
    {
      provide: SESSION_REVOKER,
      useFactory: (sessionService: SessionService) => ({ revokeAllForUser: (userId: string) => sessionService.revokeAllForUser(userId) }),
      inject: [SESSION_SERVICE],
    },
    {
      provide: RecoveryService,
      useFactory: (identityRepository: IdentityRepository, passwordHasher: PasswordHasher, emailDelivery: unknown, sessionRevoker: unknown, config: ReturnType<typeof import('@commerce/config').loadApiConfig>) => {
        return new RecoveryService(identityRepository, passwordHasher, emailDelivery as never, sessionRevoker as never, config);
      },
      inject: [IDENTITY_REPOSITORY, PASSWORD_HASHER, EMAIL_DELIVERY, SESSION_REVOKER, API_CONFIG],
    },
    AuthGuard,
  ],
  exports: [AuthGuard, SESSION_SERVICE, SESSION_REVOKER, RecoveryService],
})
export class AuthModule {}

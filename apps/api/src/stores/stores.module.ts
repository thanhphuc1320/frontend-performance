import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { StoreService } from './application/store.service';
import { StoreController } from './http/store.controller';
import { MembershipController } from './http/membership.controller';
import { MembershipService } from './application/membership.service';
import { InvitationService } from './application/invitation.service';
import { StoreRepository } from './infrastructure/store.repository';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { STORE_REPOSITORY } from './application/store.tokens';

@Module({
  imports: [IdentityModule, AuthModule, AuthorizationModule, AuditModule],
  controllers: [StoreController, MembershipController],
  providers: [
    { provide: STORE_REPOSITORY, useFactory: (database: PostgresDatabase) => new StoreRepository(database), inject: [DATABASE] },
    StoreService,
    MembershipService,
    InvitationService,
  ],
  exports: [StoreService, STORE_REPOSITORY, MembershipService, InvitationService],
})
export class StoresModule {}

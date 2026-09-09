import { Module, forwardRef } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { IdentityModule } from '../identity/identity.module';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

@Module({
  imports: [forwardRef(() => IdentityModule)],
  providers: [
    { provide: AUDIT_REPOSITORY, useFactory: (database: PostgresDatabase) => new AuditRepository(database), inject: [DATABASE] },
    { provide: AuditService, useFactory: (repository: AuditRepository) => new AuditService(repository), inject: [AUDIT_REPOSITORY] },
  ],
  exports: [AuditService, AUDIT_REPOSITORY],
})
export class AuditModule {}

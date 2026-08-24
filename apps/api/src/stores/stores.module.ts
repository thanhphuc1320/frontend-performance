import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { StoreService } from './application/store.service';
import { StoreController } from './http/store.controller';
import { StoreRepository } from './infrastructure/store.repository';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { STORE_REPOSITORY } from './application/store.tokens';

@Module({
  imports: [IdentityModule],
  controllers: [StoreController],
  providers: [
    { provide: STORE_REPOSITORY, useFactory: (database: PostgresDatabase) => new StoreRepository(database), inject: [DATABASE] },
    StoreService,
  ],
  exports: [StoreService],
})
export class StoresModule {}

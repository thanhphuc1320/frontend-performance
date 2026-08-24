import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { StoreService } from './application/store.service';
import { StoreController } from './http/store.controller';

@Module({
  imports: [IdentityModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoresModule {}

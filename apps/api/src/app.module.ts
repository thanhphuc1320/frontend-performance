import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [HealthModule, IdentityModule, StoresModule],
})
export class AppModule {}

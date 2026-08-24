import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { StoresModule } from './stores/stores.module';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './http/api-exception.filter';

@Module({
  imports: [HealthModule, IdentityModule, StoresModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}

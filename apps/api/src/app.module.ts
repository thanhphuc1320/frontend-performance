import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { StoresModule } from './stores/stores.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuditModule } from './audit/audit.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './http/api-exception.filter';

@Module({
  imports: [HealthModule, IdentityModule, StoresModule, AuthModule, AuthorizationModule, AuditModule, ProductsModule, OrdersModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}

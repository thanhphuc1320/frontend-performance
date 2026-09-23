import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { OrderController } from './http/order.controller';
import { CustomerController } from './http/customer.controller';
import { OrderService } from './application/order.service';
import { CustomerService } from './application/customer.service';
import { OrderRepository } from './infrastructure/order.repository';
import { ORDER_REPOSITORY } from './application/order.tokens';

@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule, IdentityModule],
  controllers: [OrderController, CustomerController],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useFactory: (db: PostgresDatabase) => new OrderRepository(db),
      inject: [DATABASE],
    },
    OrderService,
    CustomerService,
  ],
  exports: [OrderService, CustomerService],
})
export class OrdersModule {}

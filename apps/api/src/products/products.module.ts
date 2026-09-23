import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { ProductController } from './http/product.controller';
import { CategoryController } from './http/category.controller';
import { TagController } from './http/tag.controller';
import { ProductService } from './application/product.service';
import { CategoryService } from './application/category.service';
import { TagService } from './application/tag.service';
import { ProductRepository } from './infrastructure/product.repository';
import { PRODUCT_REPOSITORY } from './application/product.tokens';

@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule, IdentityModule],
  controllers: [ProductController, CategoryController, TagController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      useFactory: (db: PostgresDatabase) => new ProductRepository(db),
      inject: [DATABASE],
    },
    ProductService,
    CategoryService,
    TagService,
  ],
  exports: [ProductService, CategoryService, TagService],
})
export class ProductsModule {}

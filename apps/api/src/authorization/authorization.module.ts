import { Module } from '@nestjs/common';
import { AuthorizationService } from './application/authorization.service';
import { PermissionGuard } from './http/permission.guard';
import { CapabilitiesController } from './http/capabilities.controller';
import { AuthModule } from '../auth/auth.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [AuthModule, IdentityModule],
  controllers: [CapabilitiesController],
  providers: [AuthorizationService, PermissionGuard],
  exports: [AuthorizationService, PermissionGuard],
})
export class AuthorizationModule {}

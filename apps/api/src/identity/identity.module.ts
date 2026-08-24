import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service';
import { AuthController } from '../auth/http/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}

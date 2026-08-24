import { Body, Controller, Post } from '@nestjs/common';
import { IdentityService } from '../../identity/application/identity.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string }): Promise<{ accepted: true }> {
    return this.identity.register(body);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: { token: string }): Promise<{ verified: boolean }> {
    return this.identity.verifyEmail(body.token);
  }
}

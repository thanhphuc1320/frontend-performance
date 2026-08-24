import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IdentityService } from '../../identity/application/identity.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }): Promise<{ data: { accepted: true } }> {
    return { data: await this.identity.register(body) };
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: { token: string }): Promise<{ data: { verified: boolean } }> {
    return { data: await this.identity.verifyEmail(body.token) };
  }
}

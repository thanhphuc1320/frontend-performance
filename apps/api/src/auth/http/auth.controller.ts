import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IdentityService } from '../../identity/application/identity.service';
import { RecoveryService } from '../../identity/application/recovery.service';
import { SessionService } from '../application/session.service';
import type { PasswordHasher } from '../../identity/application/ports/password-hasher';
import type { IdentityStore } from '../../identity/application/identity.service';
import { ApiError } from '../../http/api-error';
import { normalizeEmail } from '../../identity/domain/email';
import type { ApiConfig } from '@commerce/config';
import { Inject } from '@nestjs/common';
import { API_CONFIG, IDENTITY_REPOSITORY, PASSWORD_HASHER } from '../../identity/application/identity.tokens';
import { SESSION_SERVICE } from '../application/session.tokens';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly identity: IdentityService,
    @Inject(SESSION_SERVICE)
    private readonly sessionService: SessionService,
    private readonly recovery: RecoveryService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(IDENTITY_REPOSITORY)
    private readonly identityRepository: IdentityStore,
    @Inject(API_CONFIG)
    private readonly config: Pick<ApiConfig, 'SESSION_COOKIE_NAME' | 'AUTH_LOCKOUT_MAX_ATTEMPTS' | 'AUTH_LOCKOUT_DURATION_SECONDS'>,
  ) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }): Promise<{ data: { accepted: true } }> {
    return { data: await this.identity.register(body) };
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: { token: string }): Promise<{ data: { verified: boolean } }> {
    return { data: await this.identity.verifyEmail(body.token) };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: Response): Promise<{ data: { userId: string } }> {
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid credentials');
    }
    const email = normalizeEmail(body.email);
    const user = await this.identityRepository.findUserByEmail(email);
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid credentials');
    }
    if (user.isLocked()) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many failed attempts');
    }
    if (user.status === 'DISABLED') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid credentials');
    }
    const valid = await this.passwordHasher.verify(body.password, user.passwordHash);
    if (!valid) {
      user.recordFailedLogin(this.config.AUTH_LOCKOUT_MAX_ATTEMPTS);
      await this.identityRepository.updateUser(user);
      if (user.isLocked()) {
        throw new ApiError(429, 'RATE_LIMITED', 'Too many failed attempts');
      }
      throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid credentials');
    }
    user.recordSuccessfulLogin();
    await this.identityRepository.updateUser(user);
    const session = await this.sessionService.create(user.id, { userAgent: undefined, ipAddress: undefined });
    this.setSessionCookies(res, session.rawToken, session.csrfToken);
    return { data: { userId: user.id } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ data: { accepted: true } }> {
    const rawToken = req.cookies?.[this.config.SESSION_COOKIE_NAME];
    if (typeof rawToken === 'string' && rawToken) {
      const context = await this.sessionService.validate(rawToken);
      if (context) {
        await this.sessionService.revokeAllForUser(context.userId);
      }
    }
    this.clearSessionCookies(res);
    return { data: { accepted: true } };
  }

  @Get('session')
  async session(@Body() body: { token?: string }): Promise<{ data: { userId?: string } }> {
    const token = body?.token;
    if (typeof token !== 'string' || !token) {
      return { data: {} };
    }
    const context = await this.sessionService.validate(token);
    return { data: context ? { userId: context.userId } : {} };
  }

  @Post('password-reset-request')
  @HttpCode(200)
  async requestPasswordReset(@Body() body: { email: string }): Promise<{ data: { accepted: true } }> {
    return { data: await this.recovery.requestPasswordReset(body) };
  }

  @Post('password-reset')
  @HttpCode(200)
  async resetPassword(@Body() body: { token: string; password: string }): Promise<{ data: { accepted: boolean } }> {
    return { data: await this.recovery.resetPassword(body.token, body.password) };
  }

  @Post('email-change-request')
  @HttpCode(200)
  async requestEmailChange(@Body() body: { newEmail: string }, @Req() req: Request & { userId?: string }): Promise<{ data: { accepted: true } }> {
    if (!req.userId) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    return { data: await this.recovery.requestEmailChange({ userId: req.userId, newEmail: body.newEmail }) };
  }

  @Post('email-change')
  @HttpCode(200)
  async verifyEmailChange(@Body() body: { token: string }): Promise<{ data: { accepted: boolean } }> {
    return { data: await this.recovery.verifyEmailChange(body.token) };
  }

  private setSessionCookies(res: Response, rawToken: string, csrfToken: string): void {
    res.cookie(this.config.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  private clearSessionCookies(res: Response): void {
    res.clearCookie(this.config.SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });
  }
}

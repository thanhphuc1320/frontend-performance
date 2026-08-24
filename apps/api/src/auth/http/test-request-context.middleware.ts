import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type RequestWithUser = Request & { userId?: string };

@Injectable()
export class TestRequestContextMiddleware implements NestMiddleware {
  use(request: RequestWithUser, _response: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'test') request.userId = request.header('x-test-user-id')?.trim();
    next();
  }
}

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mapApiError } from './api-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = request.header('x-request-id')?.trim() || randomUUID();
    const mapped = mapApiError(error, requestId);
    response.setHeader('x-request-id', requestId);
    response.status(mapped.status).json(mapped.body);
  }
}

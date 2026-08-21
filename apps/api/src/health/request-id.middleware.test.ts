import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';

type TestRequest = Request & { requestId?: string };

describe('RequestIdMiddleware', () => {
  it('generates a request ID when the incoming header is an empty string', () => {
    const request = {
      header: () => '',
    } as unknown as TestRequest;
    const response = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    new RequestIdMiddleware().use(request, response as unknown as Response, next as NextFunction);

    expect(request.requestId).toEqual(expect.any(String));
    expect(request.requestId).not.toHaveLength(0);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
  });

  it('generates a request ID when the incoming header is empty', () => {
    const request = {
      header: () => '   ',
    } as unknown as TestRequest;
    const response = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    new RequestIdMiddleware().use(request, response as unknown as Response, next as NextFunction);

    expect(request.requestId).toEqual(expect.any(String));
    expect(request.requestId).not.toHaveLength(0);
    expect(request.requestId).not.toBe('   ');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps a non-empty incoming request ID', () => {
    const request = {
      header: () => 'provided-request-id',
    } as unknown as TestRequest;
    const response = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    new RequestIdMiddleware().use(request, response as unknown as Response, next as NextFunction);

    expect(request.requestId).toBe('provided-request-id');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'provided-request-id');
  });
});

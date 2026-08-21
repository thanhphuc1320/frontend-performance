import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HealthController, REQUEST_ID_PROVIDER } from './health.controller';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: REQUEST_ID_PROVIDER,
      useFactory: () => (request?: { requestId?: string }) =>
        request?.requestId ?? randomUUID(),
    },
  ],
})
export class HealthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes(HealthController);
  }
}

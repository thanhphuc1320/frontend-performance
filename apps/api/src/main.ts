import 'reflect-metadata';
import '../../../scripts/load-env.cjs';
import { NestFactory } from '@nestjs/core';
import { loadApiConfig } from '@commerce/config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

type ApiApplication = {
  listen: (port: number) => Promise<unknown>;
  use: (middleware: unknown) => void;
  enableCors: (options: { origin: string | string[]; credentials: boolean }) => void;
};

type CreateApplication = () => Promise<ApiApplication>;

export async function bootstrap(
  env: NodeJS.ProcessEnv = process.env,
  createApplication: CreateApplication = () => NestFactory.create(AppModule) as Promise<ApiApplication>,
): Promise<void> {
  const config = loadApiConfig(env);
  const app = await createApplication();
  app.use(cookieParser());
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  await app.listen(config.API_PORT);
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'API startup failed'}\n`);
    process.exitCode = 1;
  });
}

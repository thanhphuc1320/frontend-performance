import 'reflect-metadata';
import '../../../scripts/load-env.cjs';
import { NestFactory } from '@nestjs/core';
import { loadApiConfig } from '@commerce/config';
import { AppModule } from './app.module';

type ApiApplication = {
  listen: (port: number) => Promise<unknown>;
};

type CreateApplication = () => Promise<ApiApplication>;

export async function bootstrap(
  env: NodeJS.ProcessEnv = process.env,
  createApplication: CreateApplication = () => NestFactory.create(AppModule),
): Promise<void> {
  const config = loadApiConfig(env);
  const app = await createApplication();
  await app.listen(config.API_PORT);
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'API startup failed'}\n`);
    process.exitCode = 1;
  });
}

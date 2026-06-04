import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter, PrismaExceptionFilter } from "../../src/common";

/**
 * Bootstraps the full Nest application against the test DB — same wiring as
 * `main.ts`, just without `listen()`. Tests hit it via `supertest(app.getHttpServer())`.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
  await app.init();
  return app;
}

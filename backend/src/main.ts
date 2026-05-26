import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { HttpExceptionFilter, PrismaExceptionFilter } from "./common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Order matters: PrismaExceptionFilter is more specific (@Catch on Prisma
  // errors), so register it last — NestJS applies filters in reverse, the most
  // specific catch wins for matching errors, and HttpExceptionFilter handles
  // everything else.
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { correlationIdMiddleware } from "./common/middleware/correlation-id.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // debug enabled in development so connector diagnostics (e.g. Plenty
    // search hit counts) are visible in the console
    logger: process.env.NODE_ENV === "development"
      ? ["error", "warn", "log", "debug"]
      : ["error", "warn", "log"],
  });

  // correlationId als allererste Middleware, damit jeder Response (auch
  // Fehler aus helmet/cors) den X-Correlation-Id-Header trägt.
  app.use(correlationIdMiddleware);

  // Security
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // API prefix
  app.setGlobalPrefix("api/v1");

  // Swagger (dev only)
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("adept& API")
      .setDescription("Universal Business Process Automation Platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, doc);
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`adept& Backend running on http://localhost:${port}`);
}

bootstrap();

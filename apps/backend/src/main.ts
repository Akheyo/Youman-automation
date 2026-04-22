import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

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
      .setTitle("Youman API")
      .setDescription("Universal Business Process Automation Platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, doc);
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`Youman Backend running on http://localhost:${port}`);
}

bootstrap();

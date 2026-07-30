import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { ActionsModule } from "./modules/actions/actions.module";
import { SearchModule } from "./modules/search/search.module";
import { QueueModule } from "./modules/queue/queue.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ConnectorsModule } from "./modules/connectors/connectors.module";
import { BrandingModule } from "./modules/branding/branding.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { HealthModule } from "./modules/health/health.module";
import { PlatformAdminModule } from "./modules/platform-admin/platform-admin.module";
import { DatabaseModule } from "./database/database.module";
import appConfig from "./config/app.config";
import jwtConfig from "./config/jwt.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
      envFilePath: [".env.local", ".env"],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ActionsModule,
    SearchModule,
    QueueModule,
    AuditModule,
    ConnectorsModule,
    BrandingModule,
    TemplatesModule,
    HealthModule,
    PlatformAdminModule,
  ],
})
export class AppModule {}

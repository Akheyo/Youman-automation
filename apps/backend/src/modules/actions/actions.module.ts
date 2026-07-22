import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { ConfigSyncService } from "./config-sync.service";
import { AuditModule } from "../audit/audit.module";
import { TemplatesModule } from "../templates/templates.module";

@Module({
  imports: [AuditModule, TemplatesModule],
  controllers: [ActionsController],
  providers: [ActionsService, ConfigSyncService],
  exports: [ActionsService],
})
export class ActionsModule {}

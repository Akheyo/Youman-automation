import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { AuditModule } from "../audit/audit.module";
import { TemplatesModule } from "../templates/templates.module";

@Module({
  imports: [AuditModule, TemplatesModule],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}

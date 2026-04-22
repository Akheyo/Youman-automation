import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}

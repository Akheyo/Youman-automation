import { Module } from "@nestjs/common";
import { QueueController } from "./queue.controller";
import { QueueService } from "./queue.service";
import { ActionsModule } from "../actions/actions.module";

@Module({
  imports: [ActionsModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}

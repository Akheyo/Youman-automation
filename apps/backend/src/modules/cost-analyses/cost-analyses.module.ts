import { Module } from "@nestjs/common";
import { CostAnalysesController } from "./cost-analyses.controller";
import { CostAnalysesService } from "./cost-analyses.service";

@Module({
  controllers: [CostAnalysesController],
  providers: [CostAnalysesService],
  exports: [CostAnalysesService],
})
export class CostAnalysesModule {}

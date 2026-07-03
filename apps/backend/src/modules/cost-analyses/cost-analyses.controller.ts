import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CostAnalysesService } from "./cost-analyses.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string; role: string }

@ApiTags("cost-analyses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cost-analyses")
export class CostAnalysesController {
  constructor(private readonly service: CostAnalysesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.service.list(user.tenantId);
  }

  @Get(":id")
  get(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.service.get(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    return this.service.create(user.tenantId, user.sub, body);
  }

  @Put(":id")
  update(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() body: unknown) {
    return this.service.update(user.tenantId, id, body);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.service.remove(user.tenantId, id);
  }
}

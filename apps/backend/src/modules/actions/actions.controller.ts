import { Controller, Post, Get, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ActionsService } from "./actions.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";
import { ActionExecutionSchema } from "@youman/shared";

interface JwtUser { sub: string; tenantId: string; role: string }

@ApiTags("actions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("actions")
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get("definitions")
  getDefinitions(@CurrentUser() user: JwtUser) {
    return this.actionsService.getActionDefinitions(user.tenantId);
  }

  /**
   * Verlauf der ausgeführten Aktionen, neueste zuerst. Ohne `actionId` kommen
   * alle Aktionen, mit z.B. `?actionId=action-create-quote` nur die Angebote.
   */
  @Get("history")
  getHistory(
    @CurrentUser() user: JwtUser,
    @Query("actionId") actionId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.actionsService.getHistory(user.tenantId, {
      ...(actionId ? { actionId } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(pageSize ? { pageSize: Number(pageSize) } : {}),
    });
  }

  /** Nutzlast eines Vorgangs – Grundlage, um ihn als neuen Vorgang zu übernehmen. */
  @Get("history/:id")
  getExecutionPayload(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.actionsService.getExecutionPayload(user.tenantId, id);
  }

  @Post("execute")
  @HttpCode(HttpStatus.OK)
  execute(@Body() body: unknown, @CurrentUser() user: JwtUser) {
    const dto = ActionExecutionSchema.parse({
      ...(body as Record<string, unknown>),
      tenantId: user.tenantId,
      userId: user.sub,
      clientTimestamp: (body as Record<string, unknown>)["clientTimestamp"] ?? new Date().toISOString(),
    });
    return this.actionsService.executeAction(dto);
  }
}

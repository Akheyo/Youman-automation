import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { QueueService } from "./queue.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string; role: string }

@ApiTags("queue")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("queue")
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get("status")
  getStatus(@CurrentUser() user: JwtUser) {
    return this.queueService.getStatus(user.tenantId, user.sub);
  }

  @Get("items")
  getItems(@CurrentUser() user: JwtUser, @Query("status") status?: string) {
    return this.queueService.getItems(user.tenantId, user.sub, status);
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  sync(@Body() body: { items: Parameters<QueueService["syncFromClient"]>[0] }, @CurrentUser() user: JwtUser) {
    return this.queueService.syncFromClient(body.items, user.tenantId, user.sub);
  }

  @Post("process")
  @HttpCode(HttpStatus.OK)
  process(@CurrentUser() user: JwtUser) {
    return this.queueService.processPending(user.tenantId);
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.NO_CONTENT)
  retry(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.queueService.retry(id, user.tenantId);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.queueService.cancel(id, user.tenantId);
  }
}

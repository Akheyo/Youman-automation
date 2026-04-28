import { Controller, Get, Patch, Post, Body, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string; role: string }

@ApiTags("tenants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get("settings")
  getSettings(@CurrentUser() user: JwtUser) {
    return this.tenantsService.getSettings(user.tenantId);
  }

  @Patch("settings")
  updateSettings(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.tenantsService.updateSettings(user.tenantId, body);
  }

  @Get("connector")
  getConnector(@CurrentUser() user: JwtUser) {
    return this.tenantsService.getConnectorConfig(user.tenantId);
  }

  @Patch("connector")
  updateConnector(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.tenantsService.updateConnectorConfig(user.tenantId, body as Parameters<TenantsService["updateConnectorConfig"]>[1]);
  }

  @Post("connector/test")
  @HttpCode(HttpStatus.OK)
  testConnector(@CurrentUser() user: JwtUser) {
    return this.tenantsService.testConnectorConfig(user.tenantId);
  }
}

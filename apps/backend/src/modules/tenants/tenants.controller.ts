import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string }

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
}

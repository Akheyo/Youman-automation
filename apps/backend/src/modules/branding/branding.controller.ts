import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { BrandingService } from "./branding.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string }

@ApiTags("branding")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("branding")
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  get(@CurrentUser() user: JwtUser) { return this.brandingService.get(user.tenantId); }

  @Patch()
  update(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.brandingService.update(user.tenantId, body);
  }
}

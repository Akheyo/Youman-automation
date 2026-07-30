import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiSecurity } from "@nestjs/swagger";
import { PlatformAdminService } from "./platform-admin.service";
import { PlatformAdminGuard } from "../../common/guards/platform-admin.guard";
import { CreateTenantRequestSchema } from "@youman/shared";

/**
 * Bewusst AUSSERHALB des Tenant-JWT: Wer hier anfragt, hat per Definition
 * noch keinen Mandanten. Absicherung läuft über PlatformAdminGuard
 * (geteiltes Secret), nicht über das normale Login-System.
 */
@ApiTags("platform-admin")
@ApiSecurity("platform-admin-key")
@UseGuards(PlatformAdminGuard)
@Controller("platform/tenants")
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Post()
  create(@Body() body: unknown) {
    const dto = CreateTenantRequestSchema.parse(body);
    return this.platformAdmin.createTenant(dto);
  }
}

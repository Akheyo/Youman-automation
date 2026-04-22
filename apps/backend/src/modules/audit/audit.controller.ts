import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string; role: string }

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getLogs(
    @CurrentUser() user: JwtUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50",
    @Query("userId") userId?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string
  ) {
    return this.auditService.query(user.tenantId, {
      userId,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      fromDate,
      toDate,
    });
  }
}

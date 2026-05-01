import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { CONNECTOR_TEMPLATES } from "@youman/connector-sap";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@ApiTags("connectors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("connectors")
export class ConnectorsController {
  /**
   * Returns the curated list of connector templates so the admin UI can
   * present a "pick your system" dropdown. Templates carry default endpoints
   * + which auth credentials the user must supply.
   */
  @Get("templates")
  @ApiOperation({ summary: "List available connector templates (HubSpot, sevDesk, …)" })
  listTemplates() {
    return CONNECTOR_TEMPLATES;
  }
}

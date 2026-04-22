import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string }

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser) {
    return this.usersService.findAll(user.tenantId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.findOne(id, user.tenantId);
  }
}

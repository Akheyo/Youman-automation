import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginRequestSchema, RefreshTokenSchema } from "@youman/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

// Public decorator
import { SetMetadata } from "@nestjs/common";
export const Public = () => SetMetadata("isPublic", true);

interface JwtUser {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
}

@ApiTags("auth")
@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login mit E-Mail, Passwort und Tenant-Slug" })
  async login(@Body() body: unknown, @Req() req: Request) {
    const dto = LoginRequestSchema.parse(body);
    return this.authService.login(dto, req.ip);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Access Token erneuern" })
  async refresh(@Body() body: unknown) {
    const { refreshToken } = RefreshTokenSchema.parse(body);
    return this.authService.refreshTokens(refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async logout(@CurrentUser() user: JwtUser) {
    await this.authService.logout(user.sub);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Aktuellen Benutzer abrufen" })
  me(@CurrentUser() user: JwtUser) {
    return { user };
  }
}

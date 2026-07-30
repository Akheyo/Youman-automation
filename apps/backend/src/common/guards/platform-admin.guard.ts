import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Schützt plattformweite Endpunkte (z.B. "neuen Mandanten anlegen"), die
 * bewusst AUSSERHALB des normalen Tenant-JWT liegen – ein Nutzer hat ja per
 * Definition noch keinen Mandanten, wenn er einen anlegen soll.
 *
 * Fail-closed: Ist PLATFORM_ADMIN_KEY nicht gesetzt, wird JEDE Anfrage
 * abgelehnt statt versehentlich offen zu sein.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("app.platformAdminKey");
    if (!expected) {
      throw new UnauthorizedException("Platform-Admin-Zugang ist nicht konfiguriert");
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers["x-platform-admin-key"];

    if (provided !== expected) {
      throw new UnauthorizedException("Ungültiger Platform-Admin-Schlüssel");
    }

    return true;
  }
}

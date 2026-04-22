import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLE_HIERARCHY } from "@youman/shared";
import type { UserRole } from "@youman/shared";

export const ROLES_KEY = "roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user: { role: UserRole } }>();
    const userRole = req.user?.role;

    if (!userRole) {
      throw new ForbiddenException("Keine Rolle zugewiesen");
    }

    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 0));

    if (userLevel < minRequired) {
      throw new ForbiddenException("Unzureichende Berechtigungen");
    }

    return true;
  }
}

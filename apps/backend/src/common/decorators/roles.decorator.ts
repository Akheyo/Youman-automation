import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@youman/shared";
import { ROLES_KEY } from "../guards/roles.guard";

/** Minimum role(s) required for a handler; evaluated by RolesGuard via ROLE_HIERARCHY. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

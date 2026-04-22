export type UserRole =
  | "SUPER_ADMIN"
  | "TENANT_ADMIN"
  | "MANAGER"
  | "SALES"
  | "INNENDIENST"
  | "SUPPORT"
  | "VIEWER";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  tenant: import("./tenant").Tenant;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: "read" | "write" | "delete" | "execute" | "admin";
  description: string;
}

export interface RolePermission {
  role: UserRole;
  permissions: Permission[];
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  TENANT_ADMIN: 80,
  MANAGER: 60,
  SALES: 40,
  INNENDIENST: 35,
  SUPPORT: 20,
  VIEWER: 10,
};

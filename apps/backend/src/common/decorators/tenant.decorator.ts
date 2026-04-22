import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface TenantContext {
  id: string;
  slug: string;
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<Request & { tenant: TenantContext }>();
    return req.tenant;
  }
);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request & { user: unknown }>();
    return req.user;
  }
);

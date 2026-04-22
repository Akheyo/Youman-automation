import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { Observable, tap } from "rxjs";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Audit");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: { id: string; email: string; tenantId: string };
    }>();

    const { method, url, user } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          this.logger.log(
            `${method} ${url} | tenant=${user?.tenantId ?? "anon"} user=${user?.email ?? "anon"} | ${ms}ms`
          );
        }
      })
    );
  }
}

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { getCorrelationId } from "../middleware/correlation-id.middleware";

/**
 * Strukturiertes Request-Log (eine JSON-Zeile pro Request) mit correlationId,
 * Mandanten-/Nutzer-ID, Aktionsname, Dauer und Ergebnis. Die im UI angezeigte
 * Fehler-Kennung ist damit direkt in den Render-Logs auffindbar.
 *
 * Bewusst OHNE personenbezogene Daten: keine E-Mail-Adressen, keine Payloads,
 * keine Query-Strings (Suchbegriffe können Kundendaten enthalten).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Audit");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: { id?: string; sub?: string; tenantId?: string };
      body?: { actionId?: unknown };
    }>();

    const { method, url, user } = req;
    const correlationId = getCorrelationId(req);
    const path = url.split("?")[0] ?? url;
    const actionId = typeof req.body?.actionId === "string" ? req.body.actionId : undefined;
    const start = Date.now();

    const write = (outcome: "success" | "error", errCode?: string) => {
      const line = JSON.stringify({
        correlationId,
        method,
        path,
        tenantId: user?.tenantId ?? null,
        userId: user?.id ?? user?.sub ?? null,
        ...(actionId ? { actionId } : {}),
        ms: Date.now() - start,
        outcome,
        ...(errCode ? { errCode } : {}),
      });
      // Mutationen immer sichtbar (auch in Production); GETs nur im Dev-Log,
      // Fehler übernimmt der GlobalExceptionFilter mit vollem Kontext.
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        this.logger.log(line);
      } else {
        this.logger.debug(line);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => write("success"),
        error: (err: unknown) => {
          const code = (err as { code?: unknown } | null)?.code;
          write("error", typeof code === "string" ? code : undefined);
        },
      })
    );
  }
}

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import type { ApiError } from "@youman/shared";
import { mapExceptionToApiError } from "../errors/error-mapper";
import { getCorrelationId } from "../middleware/correlation-id.middleware";

/**
 * Übersetzt JEDEN Fehler in die einheitliche Struktur
 *   { error: { code, message, details?, fields?, correlationId } }
 * (plus success/requestId für Abwärtskompatibilität älterer Clients).
 *
 * Garantie: Es landen niemals Stacktraces, SQL-Fehler, Dateipfade oder
 * Credentials im Response – der Original-Fehler wird ausschließlich mit der
 * correlationId geloggt, sodass die im UI angezeigte Kennung in den
 * Server-Logs auffindbar ist.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId = getCorrelationId(req);

    const mapped = mapExceptionToApiError(exception, correlationId);

    // Original-Fehler nur serverseitig – mit correlationId korrelierbar.
    const logLine = `[${correlationId}] ${req.method} ${req.url} -> ${mapped.status} ${mapped.code}: ${mapped.internal}`;
    if (mapped.logAsError) {
      this.logger.error(logLine, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logLine);
    }

    const body: ApiError = {
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
        ...(mapped.fields ? { fields: mapped.fields } : {}),
        correlationId,
      },
      requestId: correlationId,
    };

    if (mapped.retryAfterSeconds !== undefined) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(mapped.retryAfterSeconds))));
    }
    res.status(mapped.status).json(body);
  }
}

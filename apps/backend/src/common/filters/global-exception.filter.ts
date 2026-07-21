import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import type { ApiError } from "@youman/shared";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = uuid();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "SYS_001";
    let message = "Ein unerwarteter Fehler ist aufgetreten.";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exRes = exception.getResponse();
      if (typeof exRes === "object" && exRes !== null) {
        const r = exRes as Record<string, unknown>;
        message = String(r["message"] ?? message);
        code = String(r["code"] ?? `HTTP_${status}`);
        if (Array.isArray(r["message"])) {
          message = "Validierungsfehler";
          details = { errors: r["message"] };
        }
        // Typed errors (e.g. MissingFieldsError) carry a field list for the UI.
        if (Array.isArray(r["fields"])) {
          details = { ...details, fields: r["fields"] };
        }
      } else {
        message = String(exRes);
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${requestId}] Unhandled: ${exception.message}`,
        exception.stack
      );
    }

    const body: ApiError = {
      success: false,
      error: { code, message, details },
      requestId,
    };

    // Never leak stack traces or raw DB errors to clients
    res.status(status).json(body);
  }
}

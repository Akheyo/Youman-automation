import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/** Request-Objekt, nachdem die Middleware gelaufen ist. */
export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

export const CORRELATION_HEADER = "X-Correlation-Id";

/**
 * Vergibt pro Request eine correlationId (UUID), akzeptiert eine vom Client
 * mitgesendete Kennung (z. B. aus der Offline-Queue) und gibt sie immer im
 * Response-Header zurück. Der GlobalExceptionFilter und der AuditInterceptor
 * lesen sie vom Request, sodass Fehlermeldung im UI und Server-Logzeile
 * dieselbe Kennung tragen.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers[CORRELATION_HEADER.toLowerCase()];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
  // Nur einfache, kurze Kennungen übernehmen – niemals ungefilterte Header-Werte
  // in Logs/Responses spiegeln.
  const safe = candidate && /^[A-Za-z0-9._-]{8,64}$/.test(candidate) ? candidate : randomUUID();
  (req as RequestWithCorrelationId).correlationId = safe;
  res.setHeader(CORRELATION_HEADER, safe);
  next();
}

/** Liest die correlationId eines Requests (Fallback: neue UUID). */
export function getCorrelationId(req: unknown): string {
  const id = (req as Partial<RequestWithCorrelationId> | undefined)?.correlationId;
  return typeof id === "string" && id.length > 0 ? id : randomUUID();
}

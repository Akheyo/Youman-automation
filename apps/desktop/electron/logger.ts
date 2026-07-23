import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimaler Datei-Logger für den Main-Prozess: Fehler landen in
 * <userData>/logs/main.log statt unsichtbar im Nirwana. Bewusst synchron und
 * best-effort – der Logger selbst darf niemals einen weiteren Fehler auslösen.
 */
const MAX_LOG_BYTES = 5 * 1024 * 1024;

function logFilePath(): string {
  const dir = join(app.getPath("userData"), "logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "main.log");
}

export function logToFile(level: "info" | "warn" | "error", message: string): void {
  try {
    const file = logFilePath();
    // Einfache Rotation: eine alte Generation reicht für Diagnosezwecke.
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
      renameSync(file, file.replace(/\.log$/, ".old.log"));
    }
    appendFileSync(file, `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`);
  } catch {
    // Log-Schreibfehler bewusst ignorieren – niemals die App gefährden.
  }
  // Zusätzlich auf der Konsole (sichtbar bei Start aus dem Terminal / in CI).
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](`[main] ${message}`);
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.message}${err.stack ? `\n${err.stack}` : ""}`;
  return String(err);
}

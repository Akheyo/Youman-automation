import { safeStorage, app } from "electron";
import Database from "better-sqlite3";
import path from "path";
import { logToFile, describeError } from "../logger";

/** Vom IPC-Layer benötigte Schnittstelle – erlaubt einen Fallback-Stub. */
export interface SecureStorageLike {
  set(key: string, value: string): void;
  get(key: string): string | null;
  delete(key: string): void;
}

/**
 * Fallback, wenn die Credential-Datenbank korrupt/gesperrt ist: Die App
 * startet normal, gespeicherte Zugangsdaten sind nur nicht verfügbar (der
 * Nutzer meldet sich manuell an). `set` schlägt LAUT fehl, damit niemand
 * glaubt, seine Zugangsdaten seien gespeichert worden.
 */
export function createUnavailableSecureStorage(): SecureStorageLike {
  return {
    set: () => {
      throw new Error("Der sichere Speicher ist nicht verfügbar – Zugangsdaten konnten nicht gespeichert werden.");
    },
    get: () => null,
    delete: () => undefined,
  };
}

/**
 * Secure credential storage using Electron's safeStorage API.
 * Falls back to base64 encoding in dev environments where safeStorage is unavailable.
 */
export class SecureStorage implements SecureStorageLike {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath("userData"), "adept_secure.db");
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  set(key: string, value: string): void {
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value)
      : Buffer.from(value, "utf8");

    this.db
      .prepare("INSERT OR REPLACE INTO credentials (key, value, updated_at) VALUES (?, ?, ?)")
      .run(key, encrypted, new Date().toISOString());
  }

  get(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM credentials WHERE key = ?").get(key) as
      | { value: Buffer }
      | undefined;

    if (!row) return null;

    try {
      return safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(row.value)
        : row.value.toString("utf8");
    } catch (err) {
      // Z. B. OS-Schlüsselbund gewechselt: nicht mehr entschlüsselbar. Wie
      // "nicht vorhanden" behandeln, aber protokollieren – sonst wirkt der
      // dadurch nötige Neu-Login wie ein Geisterfehler.
      logToFile("warn", `Credential '${key}' nicht entschlüsselbar – wird wie fehlend behandelt: ${describeError(err)}`);
      return null;
    }
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM credentials WHERE key = ?").run(key);
  }
}

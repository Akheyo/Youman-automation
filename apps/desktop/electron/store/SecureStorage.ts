import { safeStorage, app } from "electron";
import Database from "better-sqlite3";
import path from "path";

/**
 * Secure credential storage using Electron's safeStorage API.
 * Falls back to base64 encoding in dev environments where safeStorage is unavailable.
 */
export class SecureStorage {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath("userData"), "youman_secure.db");
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
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM credentials WHERE key = ?").run(key);
  }
}

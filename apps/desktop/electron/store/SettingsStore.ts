import { app } from "electron";
import Database from "better-sqlite3";
import path from "path";

/** Plain key/value store for app settings (backend URL, theme, etc). Not encrypted. */
export class SettingsStore {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath("userData"), "adept_settings.db");
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  get(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
      .run(key, value, new Date().toISOString());
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}

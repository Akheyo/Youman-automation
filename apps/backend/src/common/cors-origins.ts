/**
 * Erlaubte CORS-Origins inklusive der installierten Desktop-App.
 *
 * HINTERGRUND (Ursache eines kompletten Login-Ausfalls der installierten App):
 * Die gepackte Electron-App lädt ihr UI per `loadFile(...)`, der Renderer hat
 * damit die Origin `file://` und Chromium sendet den Header `Origin: null`.
 * Bei `webSecurity: true` (korrekt so) erzwingt Chromium CORS – stand `null`
 * nicht auf der Liste, wurde JEDER API-Aufruf der installierten App blockiert.
 * Für axios sieht das aus wie ein Netzwerkfehler (keine Server-Antwort), im
 * Browser und per curl/PowerShell funktionierte dieselbe URL dagegen einwandfrei
 * (dort greift CORS nicht) – deshalb war der Fehler von außen unsichtbar.
 *
 * `app://localhost` bleibt enthalten: Die Navigations-Allowlist im Main-Prozess
 * geht davon aus, dass ein späterer Umbau auf ein eigenes app://-Protokoll
 * erfolgt. Beide Varianten sind damit abgedeckt.
 *
 * Sicherheit: Die API authentifiziert ausschließlich über Bearer-Tokens im
 * Authorization-Header (keine Cookie-Session), CORS ist hier also keine
 * tragende Schutzschicht – ein fremder Ursprung käme ohne gültiges Token
 * ohnehin nicht weiter.
 */
export const DESKTOP_APP_ORIGINS = ["null", "file://"] as const;

const DEFAULT_ORIGINS = ["http://localhost:5173", "app://localhost"];

/** Baut die CORS-Origin-Liste aus ALLOWED_ORIGINS plus den Desktop-Origins. */
export function buildAllowedOrigins(configured?: string): string[] {
  const fromEnv = (configured ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const base = fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGINS;

  return Array.from(new Set([...base, ...DESKTOP_APP_ORIGINS]));
}

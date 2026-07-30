import { describe, expect, it } from "vitest";
import { buildAllowedOrigins } from "../cors-origins";

/**
 * Beweis für den kompletten Login-Ausfall der INSTALLIERTEN App:
 * Die gepackte Electron-App lädt per loadFile → Origin `file://` → Chromium
 * sendet `Origin: null`. Stand `null` nicht auf der CORS-Liste, blockierte der
 * Browser JEDEN API-Aufruf der App, während dieselbe URL im Browser und per
 * curl/PowerShell tadellos antwortete (dort greift CORS nicht).
 * Diese Tests wären mit der alten Konfiguration rot.
 */
describe("buildAllowedOrigins", () => {
  it("erlaubt die installierte Desktop-App (Origin 'null' bei file://)", () => {
    expect(buildAllowedOrigins("https://app.example.com")).toContain("null");
  });

  it("erlaubt auch eine explizite file://-Origin", () => {
    expect(buildAllowedOrigins("https://app.example.com")).toContain("file://");
  });

  it("behält die konfigurierten Origins bei", () => {
    const origins = buildAllowedOrigins("https://a.example.com,https://b.example.com");
    expect(origins).toContain("https://a.example.com");
    expect(origins).toContain("https://b.example.com");
  });

  it("toleriert Leerzeichen und leere Einträge in ALLOWED_ORIGINS", () => {
    const origins = buildAllowedOrigins(" https://a.example.com , , https://b.example.com ");
    expect(origins).toContain("https://a.example.com");
    expect(origins).toContain("https://b.example.com");
    expect(origins).not.toContain("");
  });

  it("fällt ohne Konfiguration auf sinnvolle Standards zurück – inklusive Desktop-App", () => {
    for (const value of [undefined, ""]) {
      const origins = buildAllowedOrigins(value);
      expect(origins).toContain("http://localhost:5173"); // Dev-Server
      expect(origins).toContain("app://localhost"); // geplantes app://-Protokoll
      expect(origins).toContain("null"); // installierte App (file://)
    }
  });

  it("enthält keine Duplikate", () => {
    const origins = buildAllowedOrigins("null,file://,http://localhost:5173");
    expect(new Set(origins).size).toBe(origins.length);
  });
});

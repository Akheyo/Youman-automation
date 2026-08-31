# Echten Live-Zugriff freischalten (Netzwerk-Policy)

Diese Web-Session läuft in einer isolierten Cloud-Umgebung. Der ausgehende HTTPS-Verkehr wird
von der **Netzwerk-Policy** gesteuert, die **bei der Erstellung der Umgebung** gewählt wurde.
Die aktuelle Policy blockt `ab-solarenergy.de` (und generell ausgehendes HTTPS), daher konnte
weder der Live-Crawl noch die REST-API-Umsetzung von hier aus laufen.

Nachweis aus dieser Session:
```
gateway answered 403 to CONNECT (policy denial)  host = ab-solarenergy.de:443
curl https://example.com  -> 403   (kompletter Egress gesperrt)
WebFetch (beliebige URL)  -> 403
```

## Option A — Damit ICH es live selbst ausführe (in einer Folge-Session)
Erstelle eine neue Web-Umgebung mit einer Netzwerk-Policy, die ausgehenden Zugriff auf
`ab-solarenergy.de` (bzw. die kanonische Domain) erlaubt — z. B. „No egress restrictions"
oder eine Custom-Allowlist mit der Domain.

Dokumentation: https://code.claude.com/docs/en/claude-code-on-the-web
(Abschnitt „environments" / „network policy")

Kurz:
1. In Claude Code (Web) → Umgebung/Environment-Einstellungen.
2. Netzwerk-Policy auf offen bzw. Allowlist inkl. `ab-solarenergy.de` setzen.
3. Neue Session in dieser Umgebung starten, diesen Auftrag erneut geben.
4. Dann: echter Live-Audit (HTML, Schema, Core Web Vitals) **und** direkte REST-API-Umsetzung.

## Option B — Lokal ausführen (funktioniert sofort, ohne Policy-Änderung)
Das Paket unter `implementation/` lokal auf deinem Rechner starten (dein Rechner hat freien
Netzzugang). Siehe `implementation/README.md`. Ich habe alles so vorbereitet, dass nur noch
`.env` befüllt und `node wp-seo-apply.mjs --apply …` gestartet werden muss.

## Sicherheitshinweis zu Zugangsdaten
Application Passwords bitte **nicht** in den Chat schreiben und **nicht** ins Repo committen.
Sie gehören ausschließlich in eine lokale, nicht getrackte `.env` (bereits in `.gitignore`),
oder in eine sichere Umgebungsvariable der neuen Session. Jederzeit in WordPress widerrufbar.

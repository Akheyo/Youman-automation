# claude-seo – Installations- & Nutzungshinweise

Quelle: https://github.com/AgriciDaniel/claude-seo (MIT, v2.2.0)

Dieses Plugin wurde **fest ins Repo eingebaut**, damit es in jeder
Claude-Code-Web-Session dieses Projekts automatisch verfügbar ist.

## Struktur

- `.claude/skills/`  → Symlink auf `.claude/claude-seo/skills/` (25 SEO-Skills, Auto-Discovery)
- `.claude/agents/`  → Symlink auf `.claude/claude-seo/agents/` (18 SEO-Agenten, Auto-Discovery)
- `.claude/claude-seo/` → komplettes Plugin (Skripte, Daten, Schemas, Hooks, Extensions)

## Nutzung in Claude Code

Einfach im Chat sagen, z. B.:
- „Mach ein SEO-Audit von https://example.com" → nutzt den Skill `seo-audit`
- „Prüfe die technische SEO / Schema / Sitemap von …"

## Python-Helfer (optional, für erweiterte Funktionen)

Die Skills verweisen auf Python-Skripte (`scripts/…`). Diese liegen unter
`.claude/claude-seo/scripts/` und werden **aus dem Plugin-Ordner heraus**
ausgeführt, damit relative Pfade stimmen:

```bash
cd .claude/claude-seo
pip install -r requirements.txt      # einmalig
python3 scripts/render_page.py <url> --mode auto --json
```

## API-Keys (nur für externe Datenquellen)

Features wie DataForSEO, Moz, Bing, Google Search Console/GA4 brauchen eigene
API-Keys. Diese werden **nicht** im Repo gespeichert, sondern lokal als
Umgebungsvariablen bzw. unter `~/.config/claude-seo/` gesetzt. Ohne Keys
funktionieren die Kern-Audits (technische SEO, Content, Schema, Sitemap) trotzdem.

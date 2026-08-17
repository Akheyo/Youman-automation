# Herkunft dieses Skills

Dieser Ordner ist eine Kopie (vendored) des Skills `ui-ux-pro-max`.

- **Upstream:** https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- **Stand:** Commit `a38d04c` (2026-08-14)
- **Lizenz:** MIT, siehe `LICENSE`

## Lokale Anpassung

In `SKILL.md` wurden die Skript-Pfade von
`${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/...` auf
`.claude/skills/ui-ux-pro-max/...` umgestellt.

Grund: `CLAUDE_PLUGIN_ROOT` wird nur gesetzt, wenn der Skill als Plugin über den
Marketplace installiert wird. Hier liegt er als Projekt-Skill im Repo, deshalb
sind die Pfade relativ zum Projekt-Root.

Alle übrigen Dateien sind unverändert.

## Update auf eine neuere Version

```bash
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/uiux
rm -rf .claude/skills/ui-ux-pro-max
cp -r /tmp/uiux/.claude/skills/ui-ux-pro-max .claude/skills/
cp /tmp/uiux/LICENSE .claude/skills/ui-ux-pro-max/LICENSE
sed -i 's|\${CLAUDE_PLUGIN_ROOT}/\.claude/skills/ui-ux-pro-max/|.claude/skills/ui-ux-pro-max/|g' \
  .claude/skills/ui-ux-pro-max/SKILL.md
```

Danach diese Datei mit dem neuen Commit-Stand aktualisieren.

## Voraussetzung

Python 3.x muss verfügbar sein — die Suchfunktion des Skills läuft über
`scripts/search.py`. Externe Abhängigkeiten gibt es keine.

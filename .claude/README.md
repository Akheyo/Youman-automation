# Claude Code Skills & Agents

## claude-seo (vendored)

This directory contains the **claude-seo** skill suite, vendored from
[AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT License, v2.2.4).

- `skills/seo/` — orchestrator skill, invoked via `/seo <command> <url>`
- `skills/seo-*/` — 24 sub-skills (technical SEO, content/E-E-A-T, schema, sitemaps,
  Core Web Vitals, local, backlinks, GEO/AI-search, ecommerce, hreflang, SXO,
  clustering, drift monitoring, Google APIs, …)
- `agents/seo-*.md` — 18 specialist sub-agents for parallel audit delegation
- `skills/CLAUDE-SEO-LICENSE` — upstream MIT license (attribution)

### Why it was vendored this way

Claude Code auto-discovers any `.claude/skills/<name>/SKILL.md` and
`.claude/agents/<name>.md`, so placing the files here makes `/seo` and the
sub-skills available in every session — including Claude Code on the web,
where the `/plugin` command does **not** exist.

### Full Python toolchain (optional, not vendored here)

Some sub-skills reference bundled Python tools via `claude-seo run <script>.py`
(headless Chromium rendering, WeasyPrint PDF reports, DataForSEO/Firecrawl/Google
API integrations). That runtime is wired onto your PATH only by the real CLI
plugin install, and it was intentionally **not** copied into this repo to avoid
colliding with the existing top-level `scripts/` directory and bloating the app.

Without the runtime, the skills still work in "manual" mode — Claude performs the
analysis directly (fetching pages, evaluating content, generating schema, etc.).

To get the full tooling, install the plugin locally in the interactive
Claude Code CLI (terminal / desktop app):

```
/plugin marketplace add AgriciDaniel/claude-seo
/plugin install claude-seo@agricidaniel-claude-seo
```

### Usage

```
/seo audit https://example.com     # full site audit
/seo page https://example.com      # single-page deep dive
/seo schema https://example.com    # schema detection/generation
/seo content https://example.com   # E-E-A-T / content quality
/seo technical https://example.com # technical SEO
/seo geo https://example.com       # AI Overviews / GEO
```

#!/usr/bin/env bash
# wp-seo-check.sh — schneller Verbindungstest + Bild-Alt-Text-Report via curl.
# Nutzung:  WP_BASE_URL=... WP_USER=... WP_APP_PASSWORD='xxxx xxxx ...' ./wp-seo-check.sh
# (oder vorher:  set -a; source .env; set +a )
set -euo pipefail

: "${WP_BASE_URL:?WP_BASE_URL fehlt}"
: "${WP_USER:?WP_USER fehlt}"
: "${WP_APP_PASSWORD:?WP_APP_PASSWORD fehlt}"

BASE="${WP_BASE_URL%/}"
AUTH=$(printf '%s:%s' "$WP_USER" "$WP_APP_PASSWORD" | base64 | tr -d '\n')

echo "🔌 Teste Auth an $BASE ..."
curl -sS -H "Authorization: Basic $AUTH" \
  "$BASE/wp-json/wp/v2/users/me?context=edit&_fields=id,name,roles" \
  | { command -v jq >/dev/null && jq . || cat; }

echo
echo "📄 Erste 20 Seiten:"
curl -sS -H "Authorization: Basic $AUTH" \
  "$BASE/wp-json/wp/v2/pages?per_page=20&_fields=id,slug,title.rendered,link" \
  | { command -v jq >/dev/null && jq -r '.[] | "  \(.id)  /\(.slug)"' || cat; }

echo
echo "🖼️  Bilder OHNE Alt-Text (erste 50):"
curl -sS -H "Authorization: Basic $AUTH" \
  "$BASE/wp-json/wp/v2/media?per_page=100&_fields=id,source_url,alt_text,media_type" \
  | { command -v jq >/dev/null \
        && jq -r '.[] | select(.media_type=="image" and (.alt_text|length==0)) | "  \(.id)  \(.source_url)"' \
        || cat; }

echo
echo "✅ Check fertig. Alt-Texte/Metas setzen mit:  node wp-seo-apply.mjs --apply --alt --meta"

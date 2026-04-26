#!/usr/bin/env bash
# Upload 3D Tiles to a Cloudflare R2 bucket via rclone.
#
# Prerequisite: `rclone config` with a remote named "r2-lod2" pointing at
# Cloudflare R2 (see ./README.md).
#
# Usage:
#   ./3_upload_to_r2.sh --bucket lod2-nrw --path borken
#   ./3_upload_to_r2.sh --bucket lod2-nrw --sync   # delta-sync everything

set -euo pipefail

REMOTE="r2-lod2"
SOURCE="./3dtiles"
BUCKET=""
PATH_PREFIX=""
SYNC_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)  BUCKET="$2"; shift 2 ;;
    --path)    PATH_PREFIX="$2"; shift 2 ;;
    --source)  SOURCE="$2"; shift 2 ;;
    --remote)  REMOTE="$2"; shift 2 ;;
    --sync)    SYNC_MODE=true; shift ;;
    -h|--help)
      head -10 "$0" | grep '^#'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$BUCKET" ]]; then
  echo "Error: --bucket required" >&2
  exit 1
fi

if ! command -v rclone >/dev/null; then
  echo "Error: rclone is not installed. https://rclone.org/install/" >&2
  exit 1
fi

LOCAL="$SOURCE/$PATH_PREFIX"
REMOTE_PATH="${REMOTE}:${BUCKET}/${PATH_PREFIX}"

echo "[upload] $LOCAL → $REMOTE_PATH"

if [[ "$SYNC_MODE" == true ]]; then
  rclone sync "$LOCAL" "$REMOTE_PATH" \
    --transfers 16 \
    --checkers 32 \
    --header-upload "Cache-Control: public, max-age=31536000, immutable" \
    --header-upload "Content-Type-Json: application/json" \
    --progress
else
  rclone copy "$LOCAL" "$REMOTE_PATH" \
    --transfers 16 \
    --checkers 32 \
    --header-upload "Cache-Control: public, max-age=31536000, immutable" \
    --progress
fi

PUBLIC_URL=$(rclone config show "$REMOTE" | grep endpoint | awk '{print $3}' || echo "")
if [[ -n "$PUBLIC_URL" ]]; then
  echo
  echo "[upload] Tileset URL (set as NEXT_PUBLIC_LOD2_TILESET_URL):"
  echo "  ${PUBLIC_URL}/${BUCKET}/${PATH_PREFIX}/tileset.json"
fi

#!/usr/bin/env bash
# Download NRW LoD2 CityGML tiles from Open Geodata NRW.
#
# Source: https://www.opengeodata.nrw.de/produkte/geobasis/3dg/3dgm_lod2/
# License: Datenlizenz Deutschland Zero - Version 2.0
#
# Usage:
#   ./1_download_citygml.sh --bezirk borken
#   ./1_download_citygml.sh --bezirk muenster --gemeinde borken
#   ./1_download_citygml.sh --since 2026-01-01

set -euo pipefail

BASE_URL="https://www.opengeodata.nrw.de/produkte/geobasis/3dg/3dgm_lod2/aktuell/CityGML"
OUTPUT_DIR="./citygml"
BEZIRK=""
GEMEINDE=""
SINCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bezirk)    BEZIRK="$2"; shift 2 ;;
    --gemeinde)  GEMEINDE="$2"; shift 2 ;;
    --since)     SINCE="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    -h|--help)
      head -20 "$0" | grep '^#'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$BEZIRK" ]]; then
  echo "Error: --bezirk required (one of: arnsberg, detmold, duesseldorf, koeln, muenster)" >&2
  exit 1
fi

TARGET="${OUTPUT_DIR}/${BEZIRK}"
if [[ -n "$GEMEINDE" ]]; then
  TARGET="${OUTPUT_DIR}/${GEMEINDE}"
fi
mkdir -p "$TARGET"

INDEX_URL="${BASE_URL}/${BEZIRK}/index.xml"
echo "[lod2] Fetching tile index: $INDEX_URL"
INDEX_FILE=$(mktemp)
curl --fail --silent --show-error -o "$INDEX_FILE" "$INDEX_URL" || {
  echo "[lod2] Index not reachable. Check NRW Open Geodata URL." >&2
  exit 2
}

# Parse tile filenames from the XML index. NRW uses a simple filelist.
TILES=$(grep -oE '[A-Z0-9_]+\.gml(\.gz)?' "$INDEX_FILE" | sort -u)
TILE_COUNT=$(echo "$TILES" | wc -l)
echo "[lod2] Found $TILE_COUNT tile files for ${BEZIRK}${GEMEINDE:+/$GEMEINDE}"

i=0
for tile in $TILES; do
  i=$((i + 1))
  # Filter by gemeinde if requested (NRW tile names embed Gemarkung codes).
  if [[ -n "$GEMEINDE" && ! "$tile" =~ ${GEMEINDE^^} ]]; then
    continue
  fi
  if [[ -n "$SINCE" ]]; then
    LAST_MOD=$(curl --silent --head "${BASE_URL}/${BEZIRK}/${tile}" | grep -i Last-Modified | cut -d' ' -f2- || echo "")
    if [[ -n "$LAST_MOD" ]]; then
      LAST_TS=$(date -d "$LAST_MOD" +%s 2>/dev/null || echo 0)
      SINCE_TS=$(date -d "$SINCE" +%s)
      if (( LAST_TS < SINCE_TS )); then continue; fi
    fi
  fi
  printf "[lod2] (%d/%d) %s\n" "$i" "$TILE_COUNT" "$tile"
  curl --fail --silent --show-error --output "${TARGET}/${tile}" "${BASE_URL}/${BEZIRK}/${tile}"
done

rm -f "$INDEX_FILE"
echo "[lod2] Done. Output: ${TARGET}"

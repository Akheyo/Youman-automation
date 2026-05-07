#!/usr/bin/env bash
# Convenience-Starter für macOS / Linux.
# Legt eine Virtual Environment an, installiert Dependencies und startet die App.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "→ Lege Virtual Environment an ..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

if [ ! -f ".venv/.deps_installed" ]; then
  echo "→ Installiere Dependencies ..."
  pip install --upgrade pip >/dev/null
  pip install -r requirements.txt
  touch .venv/.deps_installed
fi

echo "→ Starte Paletten Optimierer ..."
python run_app.py

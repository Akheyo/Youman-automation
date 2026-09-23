#!/usr/bin/env bash
# Prueft, ob jede Plenty-Klasse, die das Plugin per "use" einbindet, in der
# offiziellen Plugin-Schnittstelle existiert.
#
# Warum: Ein falscher Namensraum ist fuer PHP kein Syntaxfehler, und der
# Plugin-Build von Plenty merkt ihn auch nicht. Er faellt erst zur Laufzeit
# auf — als "Target class ... does not exist", und nur, wenn jemand ins
# Protokoll schaut. Genau so ist am 23.09. ein Tippfehler (Item\Images statt
# Item\ItemImage) eine Stunde lang unbemerkt geblieben.
set -euo pipefail

hier="$(cd "$(dirname "$0")/.." && pwd)"
ziel="${PLENTY_SCHNITTSTELLE:-${TMPDIR:-/tmp}/plenty-plugin-interface}"

if [ ! -d "$ziel/Modules" ]; then
    rm -rf "$ziel"
    git clone -q --depth 1 https://github.com/plentymarkets/plugin-interface.git "$ziel"
fi

fehlt=0
while read -r klasse; do
    pfad="$(echo "$klasse" | sed 's/^Plenty\\//; s/\\/\//g')"
    if [ ! -f "$ziel/$pfad.php" ]; then
        echo "FEHLT in der Plenty-Schnittstelle: $klasse"
        fehlt=1
    fi
done < <(grep -rhoE '^use Plenty\\[A-Za-z0-9\\]+;' "$hier/src" | sed 's/^use //; s/;$//' | sort -u)

if [ "$fehlt" -ne 0 ]; then
    exit 1
fi
echo "Alle eingebundenen Plenty-Klassen existieren."

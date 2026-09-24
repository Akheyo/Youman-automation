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

# "implements" nur fuer Schnittstellen, "extends" nur fuer Klassen. PHP
# prueft das erst beim Laden der Klasse; ein Zeitplan mit dem falschen
# Schluesselwort stirbt, bevor er eine Zeile ausfuehrt, und hinterlaesst
# nichts im Protokoll. So ist es am 23.09. mit CronHandler passiert, der in
# Plenty eine abstrakte Klasse ist.
while IFS=: read -r datei _ zeile; do
    art=$(echo "$zeile" | grep -oE '(implements|extends) [A-Za-z]+' | head -1 | cut -d' ' -f1)
    kurz=$(echo "$zeile" | grep -oE '(implements|extends) [A-Za-z]+' | head -1 | cut -d' ' -f2)
    voll=$(grep -hoE "^use Plenty\\\\[A-Za-z0-9\\\\]+( as $kurz)?;" "$datei" | grep -E "\\\\$kurz;|as $kurz;" | head -1 | sed 's/^use //; s/ as .*//; s/;$//' || true)
    # Keine Plenty-Klasse (z. B. eine eigene Oberklasse im Plugin): nichts zu pruefen.
    [ -z "$voll" ] && continue
    pfad="$ziel/$(echo "$voll" | sed 's/^Plenty\\//; s/\\/\//g').php"
    [ -f "$pfad" ] || continue
    if grep -qE '^interface ' "$pfad"; then
        if [ "$art" = "extends" ]; then echo "$datei: $kurz ist eine Schnittstelle - implements statt extends"; fehlt=1; fi
    else
        if [ "$art" = "implements" ]; then echo "$datei: $kurz ist eine Klasse - extends statt implements"; fehlt=1; fi
    fi
done < <(grep -rnE '^(abstract )?class [A-Za-z]+ (extends|implements) ' "$hier/src")

# Jede Migrationsklasse muss in plugin.json stehen, sonst laeuft sie nie.
for m in "$hier"/src/Migrations/*.php; do
    name=$(basename "$m" .php)
    if ! grep -q "Migrations\\\\\\\\$name\"" "$hier/plugin.json"; then
        echo "Migration $name steht nicht unter runOnBuild in plugin.json"
        fehlt=1
    fi
done

if [ "$fehlt" -ne 0 ]; then
    exit 1
fi
echo "Alle eingebundenen Plenty-Klassen existieren, Vererbung und Migrationen stimmen."

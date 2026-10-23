#!/usr/bin/env bash
# Überträgt Umgebungsvariablen aus einer .env-Datei in das aktuell verknüpfte
# Vercel-Projekt. Gedacht für den Kontowechsel: einmal aus dem alten Projekt
# ziehen, einmal ins neue schieben – statt zwei Dutzend Felder abzutippen.
#
#   1) Werte aus dem ALTEN Projekt holen:
#        npx vercel login            # altes Konto
#        npx vercel link             # altes Projekt wählen
#        npx vercel env pull .env.umzug.local --environment=production
#
#   2) Ins NEUE Projekt schieben:
#        npx vercel logout && npx vercel login    # neues Konto
#        npx vercel link                          # neues Projekt wählen
#        ./scripts/env-uebertragen.sh .env.umzug.local production
#
#   3) .env.umzug.local löschen – sie enthält Klartext-Passwörter.
#
# Das Skript legt nur an, es löscht nichts. Existiert eine Variable im Ziel
# schon, bleibt sie unangetastet und wird am Ende als übersprungen gemeldet.

set -u

datei="${1:-}"
umgebung="${2:-production}"

if [ -z "$datei" ] || [ ! -f "$datei" ]; then
  echo "Aufruf: $0 <env-datei> [production|preview|development]" >&2
  echo "Die Datei entsteht mit: npx vercel env pull <env-datei> --environment=production" >&2
  exit 1
fi

case "$umgebung" in
  production|preview|development) ;;
  *) echo "Unbekannte Umgebung: $umgebung" >&2; exit 1 ;;
esac

if ! npx --no-install vercel whoami >/dev/null 2>&1; then
  echo "Nicht bei Vercel angemeldet. Erst 'npx vercel login' und 'npx vercel link'." >&2
  exit 1
fi

konto=$(npx --no-install vercel whoami 2>/dev/null)
echo "Ziel-Konto:   $konto"
echo "Ziel-Umgebung: $umgebung"
echo "Quelle:        $datei"
echo
read -r -p "Weiter? [j/N] " antwort
case "$antwort" in j|J|y|Y) ;; *) echo "Abgebrochen."; exit 0 ;; esac
echo

gesetzt=0; leer=0; fehler=0

while IFS= read -r zeile || [ -n "$zeile" ]; do
  # Kommentare, Leerzeilen und ein eventuelles "export " davor.
  case "$zeile" in ''|'#'*) continue ;; esac
  zeile="${zeile#export }"
  case "$zeile" in *=*) ;; *) continue ;; esac

  name="${zeile%%=*}"
  wert="${zeile#*=}"

  # Name muss wie eine Umgebungsvariable aussehen – schützt vor Müllzeilen.
  case "$name" in
    *[!A-Za-z0-9_]*|'') continue ;;
  esac

  # Umschließende Anführungszeichen entfernen (vercel env pull setzt welche).
  if [ ${#wert} -ge 2 ]; then
    case "$wert" in
      \"*\") wert="${wert#\"}"; wert="${wert%\"}" ;;
      \'*\') wert="${wert#\'}"; wert="${wert%\'}" ;;
    esac
  fi

  if [ -z "$wert" ]; then
    printf '  —  %-32s leer, übersprungen\n' "$name"
    leer=$((leer + 1))
    continue
  fi

  if printf '%s' "$wert" | npx --no-install vercel env add "$name" "$umgebung" >/dev/null 2>&1; then
    printf '  ✓  %-32s gesetzt\n' "$name"
    gesetzt=$((gesetzt + 1))
  else
    printf '  ✗  %-32s nicht gesetzt (existiert sie schon?)\n' "$name"
    fehler=$((fehler + 1))
  fi
done < "$datei"

echo
echo "Fertig: $gesetzt gesetzt, $leer leer übersprungen, $fehler nicht gesetzt."
echo "Danach einmal neu deployen, damit die Werte greifen – und '$datei' löschen."
[ "$fehler" -eq 0 ]

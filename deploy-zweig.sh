#!/usr/bin/env bash
#
# Baut den Zweig, auf den PlentyONE zeigt.
#
# WARUM ES DEN BRAUCHT: Plenty bekommt beim Einrichten eine Repository-Adresse
# und einen ZWEIGNAMEN — und verlangt, dass in der Wurzel dieses Zweigs eine
# gueltige plugin.json liegt ("The branch must contain a valid plugin JSON").
# Hier im Repo liegt das Plugin aber in einem Unterordner neben den anderen
# Projekten. Dieses Skript schneidet genau diesen Ordner als eigenen Zweig
# heraus, mit der plugin.json an der Wurzel. Die Historie bleibt erhalten.
#
#   ./plugin-maschinensucher/deploy-zweig.sh          # Zweig bauen
#   git push -f origin plugin/maschinensucher         # und hochladen
#
# Nach jeder Aenderung am Plugin erneut ausfuehren und pushen; in Plenty dann
# im Git-Bereich des Plugins neu bereitstellen (deploy).

set -euo pipefail

ORDNER="plugin-maschinensucher"
ZWEIG="${1:-plugin/maschinensucher}"

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Es liegen ungespeicherte Aenderungen vor — erst committen." >&2
  exit 1
fi

# Nichts ausliefern, was die Pruefung nicht besteht. Der Zweig geht direkt in
# ein Livesystem; das ist die letzte Stelle, an der es auffaellt.
php "$ORDNER/tests/run.php"

git branch -D "$ZWEIG" >/dev/null 2>&1 || true
git subtree split --prefix "$ORDNER" -b "$ZWEIG" >/dev/null

echo
echo "Zweig '$ZWEIG' gebaut. Wurzel:"
git ls-tree --name-only "$ZWEIG" | sed 's/^/  /'
echo
echo "Hochladen:  git push -f origin $ZWEIG"

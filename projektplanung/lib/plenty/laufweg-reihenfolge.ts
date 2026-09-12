/**
 * Die Reihenfolge, in der das Lager Burlo abgelaufen wird.
 *
 * PlentyONE kennt keine Koordinaten — es gibt kein Feld "Regal X steht neben
 * Regal Y". Der Laufweg entsteht allein aus der Reihenfolge der Knoten. Also
 * steht sie hier, abgelesen vom Hallenplan (Stand 10.09.2026, nach Begehung)
 * und vom Lagerleiter bestätigt.
 *
 * Ändert sich etwas im Lager, wird diese Datei angepasst und der Laufweg neu
 * geordnet — sonst nichts.
 */

/** Hallen in Laufreihenfolge. Was hier fehlt, kommt hinten, natürlich sortiert. */
export const HALLEN_REIHENFOLGE: string[] = ['H3', 'H2', 'H1', 'H4', 'H5', 'H6'];

/**
 * Je Halle die Regale in Laufreihenfolge.
 *
 * Abgelesen vom Hallenplan: erst die Fachbodenregale am Tor, dann die langen
 * Palettenregale. Ein Regal, das hier fehlt, kommt hinter die bekannten —
 * so wird nie eines verschluckt, nur schlechter einsortiert.
 */
export const REGAL_REIHENFOLGE: Record<string, string[]> = {
  H3: ['R9', 'R8', 'R6', 'R4', 'R3', 'R2', 'R1', 'R11', 'R7', 'R10', 'R5'],
  H2: ['R6', 'R4', 'R5', 'R8', 'R9', 'R10', 'R3', 'R2', 'R1', 'R7', 'RKTL'],
  H1: ['R13', 'R12', 'R11', 'R10', 'R9', 'RKTL', 'R1', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2'],
  // Halle 4 ist im Hallenplan fast leer, im Lagerort-Export steckt dort aber
  // ein ganzer KTL-Bereich mit 15 Regalen und rund 2.400 Plätzen. Die
  // Reihenfolge ist geraten (aufsteigend) — sie muss noch bestätigt werden.
  H4: [
    'R1', 'R2', 'R3', 'RKTL',
    'R1KTL', 'R2KTL', 'R3KTL', 'R4KTL', 'R5KTL', 'R6KTL', 'R7KTL', 'R8KTL',
    'R9KTL', 'R10KTL', 'R11KTL', 'R12KTL', 'R13KTL', 'R14KTL', 'R15KTL',
  ],
  H5: ['R7', 'R6', 'R2', 'R3', 'R1', 'R4', 'R5', 'R10', 'RKTL'],
  // In Halle 6 beginnt der Rundgang zwischen den roten Fachbodenregalen, und
  // zwar bei R8KTL abwärts. Erst danach die grossen Palettenregale.
  H6: [
    'R8KTL', 'R7KTL', 'R6KTL', 'R5KTL', 'R4KTL', 'R3KTL', 'R2KTL', 'R1KTL',
    'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  ],
};

/**
 * Regale, in denen die Felder rückwärts gezählt werden — der Mann kommt dort
 * vom hohen Feld her herein. Schlüssel: "Halle/Regal".
 *
 * Abgelesen aus der Begehung: In H1 etwa liegt bei Regal 8 auf der Seite, wo
 * Regal 1 mit Feld 1 beginnt, schon Feld 23/24 — er läuft also von hinten
 * nach vorn. Was hier nicht steht, zählt aufwärts.
 */
export const FELDER_RUECKWAERTS: string[] = [
  // Halle 1 — die langen Palettenregale laufen alle von hinten nach vorn.
  'H1/R8', 'H1/R7', 'H1/R6', 'H1/R5', 'H1/R4',
  // Halle 2 — im Gang zwischen R2 und R3 beginnt beides bei Feld 19.
  'H2/R3', 'H2/R2',
  // Halle 3
  'H3/R9', 'H3/R7', 'H3/R10',
  // Halle 4
  'H4/R2', 'H4/R3',
  // Halle 5
  'H5/R3', 'H5/R1', 'H5/R5', 'H5/R10',
  // Halle 6 — R7 hat 12 Felder, der Mann sieht Feld 12 rechts.
  'H6/R7',
];

/**
 * Platz eines Namens in einer Reihenfolge — unbekannte landen hinten.
 * Gross/klein und führende Nullen sind egal: "r07" findet "R7".
 */
export function platzIn(reihenfolge: string[], name: string): number {
  const norm = (s: string) => s.trim().toUpperCase().replace(/(?<=\D)0+(\d)/, '$1');
  const gesucht = norm(name);
  const i = reihenfolge.findIndex((x) => norm(x) === gesucht);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

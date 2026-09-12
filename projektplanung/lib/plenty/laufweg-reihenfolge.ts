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
  H3: ['R10', 'R8', 'R6', 'R4', 'R5', 'R3', 'R2', 'R1', 'R11', 'R7', 'R9'],
  H2: ['R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'R8', 'R9', 'R10'],
  H1: ['R13', 'R12', 'R11', 'R10', 'R9', 'R1', 'R8', 'R7', 'R6', 'R5', 'R3', 'R2', 'R4', 'R14'],
  H4: ['R4', 'R3', 'R2', 'R1'],
  H5: ['R10', 'R5', 'R4', 'R3', 'R2', 'R6', 'R7', 'R1'],
  H6: ['R5', 'R4', 'R3', 'R2', 'R1'],
};

/**
 * Regale, in denen die Felder rückwärts gezählt werden — weil der Mann von
 * der anderen Seite hereinkommt. Schlüssel: "Halle/Regal".
 *
 * Noch leer: Solange nicht feststeht, wo rückwärts gelaufen wird, zählen
 * überall die Felder aufwärts. Eine falsche Umkehr wäre schlimmer als gar
 * keine — sie schickt den Mann garantiert zweimal durch denselben Gang.
 */
export const FELDER_RUECKWAERTS: string[] = [];

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

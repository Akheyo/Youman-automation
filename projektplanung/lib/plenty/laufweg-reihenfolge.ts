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
  // Halle 2 hat ein Podest: R2 bis R5 tragen unten die Ebenen A-C und darueber,
  // auf dem Podest, D-F. Die Treppe steht am linken Ende von R1, bei den
  // Feldern 21-24 — dort, wo es zu Halle 3 R6 rueberginge (Durchgang zu).
  //
  // PlentyONE sortiert den Laufweg Halle > Regal > Ebene > Feld. Das Regal
  // steht ueber der Ebene, also liegen die Ebenen eines Regals im Laufweg
  // immer direkt hintereinander. "Erst alle Regale unten, danach alle oben"
  // laesst sich mit Positionen nicht ausdruecken — dafuer muessten die
  // Podest-Ebenen unter einem eigenen Regal-Knoten haengen.
  //
  // Das Naechstbeste, und genau das steht hier: die vier Podest-Regale kommen
  // ans Ende der Halle. Der Mann laeuft erst die reinen Bodenregale ab und
  // arbeitet das Podest am Stueck hinterher, statt in der Mitte der Halle
  // hoch- und wieder runterzusteigen.
  // R7 liegt ganz oben in der Halle, direkt ueber R6 — es beginnt also den
  // Rundgang. R8/R9/R10 sind die roten Regale am unteren Ende des R1-Gangs,
  // am weitesten von R7/R6 entfernt. Von dort laeuft er R1 zurueck (dessen
  // Felder zaehlen von rechts nach links) und kommt an der Treppe heraus.
  H2: ['R7', 'R6', 'RKTL', 'R8', 'R9', 'R10', 'R1', 'R2', 'R3', 'R4', 'R5'],
  H1: ['R13', 'R12', 'R11', 'R10', 'R9', 'RKTL', 'R1', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2'],
  // Halle 4: die KTL-Reihe auf der Lagerbuehne. Sie besteht aus Doppelregalen,
  // und zwar so, dass sich aufeinanderfolgende Nummern einen Gang teilen:
  //
  //   Wand | R1KTL : R2KTL||R3KTL : R4KTL||R5KTL : R6KTL||R7KTL : …
  //          \_Gang_/       \_Gang_/       \_Gang_/
  //
  // R1KTL liegt vorn, an der Treppe zum Podest; von dort geht es nach hinten
  // durch bis R15KTL. Alles ausser R1KTL sind Doppelregale, ein Gang trennt
  // immer zwei aufeinanderfolgende Nummern (R1/R2, R3/R4, …) — die Zahlenreihe
  // ist damit zugleich die Gangfolge.
  // RKTL steht vorn am Eingang und wird im Vorbeigehen mitgenommen.
  //
  // Auf dem Podest darueber steht dieselbe Reihe noch einmal, dort mit P
  // statt R — nur in Halle 4. Diese Regale kommen komplett ans Ende: erst
  // unten alles holen, dann einmal hoch. Anders als in Halle 2 geht das hier
  // sauber, weil das Podest eigene Regal-Knoten hat und nicht an den Ebenen
  // der Bodenregale haengt.
  //
  // Im Export vom 12.09.2026 gibt es diese Regale in PlentyONE noch nicht.
  // Sie stehen hier trotzdem schon, damit sie beim Anlegen sofort an der
  // richtigen Stelle einsortiert werden.
  H4: [
    'RKTL',
    'R1KTL', 'R2KTL', 'R3KTL', 'R4KTL', 'R5KTL', 'R6KTL', 'R7KTL', 'R8KTL',
    'R9KTL', 'R10KTL', 'R11KTL', 'R12KTL', 'R13KTL', 'R14KTL', 'R15KTL',
    // Podest: Die Treppe steht am R1KTL-Ende, am schraffierten Zwischenraum.
    // Er laeuft unten bis R15KTL nach hinten, kommt zur Treppe zurueck und
    // beginnt oben bei P1KTL — dieselbe Richtung wie unten, von 1 nach 15.
    'P1KTL', 'P2KTL', 'P3KTL', 'P4KTL', 'P5KTL', 'P6KTL', 'P7KTL', 'P8KTL',
    'P9KTL', 'P10KTL', 'P11KTL', 'P12KTL', 'P13KTL', 'P14KTL', 'P15KTL',
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
 * Regale, die ein Podest tragen: unten Ebene A-C, darueber D-F.
 * Schluessel: "Halle/Regal". Sie stehen in REGAL_REIHENFOLGE bewusst hinten —
 * siehe die Begruendung dort.
 */
export const PODEST_REGALE: string[] = ['H2/R2', 'H2/R3', 'H2/R4', 'H2/R5'];

/**
 * Hallen, unterhalb derer nichts umnummeriert wird.
 *
 * Zurzeit keine. Halle 4 stand hier, solange die Reihenfolge der KTL-Reihe auf
 * der Lagerbuehne ungeklaert war; sie steht jetzt in REGAL_REIHENFOLGE.
 */
export const NICHT_ORDNEN: string[] = [];

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
  // Halle 6 — dieselbe Doppelregal-Struktur wie Halle 4: an der Wand R1, dann
  // die Paare R2/R3 und R4/R5, an der anderen Wand R6. In allen diesen Regalen
  // liegt Feld 1 an dem Ende, das im Hallenplan das hohe Feld trug — der Mann
  // laeuft sie also rueckwaerts durch die Zahlenreihe ab.
  // R1 ist die Ausnahme: es geht ums Eck, an der Ecke liegen F1 bis F3 und ab
  // F4 laeuft der lange Schenkel durch.
  'H6/R2', 'H6/R3', 'H6/R4', 'H6/R5', 'H6/R6',
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

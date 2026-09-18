/**
 * Was die Strukturabfrage eines Lagers in Klartext bedeutet.
 *
 * Hintergrund: Bevor in einem Lager Lagerorte angelegt werden können, müssen
 * dort vier Spalten eingerichtet sein — Halle, Regal, Ebene, Feld. Fehlt eine,
 * bricht der Anlagelauf in der ersten Zeile ab, und zwar mit einer Meldung,
 * die man erst deuten muss.
 *
 * Diese Datei übersetzt die rohe Antwort von
 * `GET /api/lagerplatz/lagerorte?struktur=1&warehouseId=…` in Zeilen, die man
 * ohne Plenty-Kenntnisse lesen kann. Sie rechnet nichts und schreibt nichts —
 * sie beschreibt nur, was da ist.
 *
 * Zu den Haken „Position für Laufweg berücksichtigen": Wie das Feld in der
 * REST-Antwort heißt, ist nicht dokumentiert. Deshalb wird nicht geraten,
 * sondern jedes Ja/Nein-Feld der Spalte mit seinem echten Namen ausgegeben.
 * Steht da nichts, sagt der Bericht genau das — und nicht „Haken fehlt".
 */

/** Die Antwort der Strukturabfrage, so viel davon wie hier gebraucht wird. */
export interface StrukturAntwort {
  dimensionen?: unknown;
  knotenGesamt?: number;
  vollstaendig?: boolean;
  knotenJeDimension?: Array<{ dimensionId: number; anzahl: number }>;
  obersteKnoten?: Array<{ id: number; name: string; dimensionId: number }>;
}

/** Die vier Spalten, die der Anlagelauf braucht — in dieser Reihenfolge. */
export const ERWARTETE_SPALTEN = ['Halle', 'Regal', 'Ebene', 'Feld'] as const;

const istObjekt = (w: unknown): w is Record<string, unknown> =>
  typeof w === 'object' && w !== null && !Array.isArray(w);

/** Holt die Spaltenliste heraus, egal ob als Array oder als `{ entries }`. */
function spaltenAus(roh: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(roh)) return roh.filter(istObjekt);
  if (istObjekt(roh) && Array.isArray(roh.entries)) return roh.entries.filter(istObjekt);
  return [];
}

/**
 * Felder, die zwar 0 oder 1 sein können, aber Zahlen sind und keine Schalter.
 * Ohne diese Liste läse der Bericht `level: 1` als „Haken gesetzt".
 */
const KEINE_SCHALTER = new Set([
  'id', 'level', 'warehouseId', 'position', 'parentId', 'dimensionId', 'sort', 'depth',
]);

/**
 * Ja/Nein-Felder einer Spalte, mit ihrem echten Namen aus der API.
 *
 * Auch 0/1 und "true"/"false" zählen — Plenty liefert Schalter mal so, mal so.
 */
function schalter(d: Record<string, unknown>): Array<{ name: string; an: boolean }> {
  const raus: Array<{ name: string; an: boolean }> = [];
  for (const [name, wert] of Object.entries(d)) {
    if (typeof wert === 'boolean') raus.push({ name, an: wert });
    else if (KEINE_SCHALTER.has(name)) continue;
    else if (wert === 0 || wert === 1) raus.push({ name, an: wert === 1 });
    else if (wert === 'true' || wert === 'false') raus.push({ name, an: wert === 'true' });
  }
  return raus;
}

/**
 * Macht aus der Strukturantwort Zeilen für den Bildschirm.
 *
 * Die letzte Zeile ist immer das Fazit: anlegen möglich oder nicht, und woran
 * es liegt.
 */
export function strukturBericht(antwort: StrukturAntwort): string[] {
  const spalten = spaltenAus(antwort.dimensionen).sort(
    (a, b) => Number(a.level ?? 0) - Number(b.level ?? 0),
  );
  const zeilen: string[] = [];

  if (!spalten.length) {
    zeilen.push('Dieses Lager hat keine einzige Strukturspalte.');
    zeilen.push(
      'Fazit: Anlegen nicht möglich. Halle, Regal, Ebene und Feld müssen erst ' +
        'im Backend eingerichtet werden (Waren » Lager » Lagerorte » Dimensionen).',
    );
    return zeilen;
  }

  const anzahl = new Map<number, number>();
  for (const e of antwort.knotenJeDimension ?? []) anzahl.set(e.dimensionId, e.anzahl);

  for (const d of spalten) {
    const id = Number(d.id ?? 0);
    const name = String(d.name ?? '').trim() || '(ohne Namen)';
    const kuerzel = String(d.shortcut ?? '').trim();
    const knoten = anzahl.get(id) ?? 0;
    const schalterTeil = schalter(d)
      .map((s) => `${s.name}: ${s.an ? 'ja' : 'nein'}`)
      .join(' · ');
    zeilen.push(
      `${Number(d.level ?? 0)} · ${name} — Kürzel ${kuerzel ? `„${kuerzel}"` : '(keins)'} · ` +
        `${knoten} Knoten · ID ${id}` +
        (schalterTeil ? ` · ${schalterTeil}` : ' · keine Ja/Nein-Felder in der Antwort'),
    );
  }

  zeilen.push(`Knoten insgesamt: ${antwort.knotenGesamt ?? 0}`);
  const oberste = antwort.obersteKnoten ?? [];
  if (oberste.length) {
    zeilen.push(
      `Oberste Knoten: ${oberste.map((k) => `${k.name} (ID ${k.id})`).join(', ')}`,
    );
  }

  // Fazit. Die Reihenfolge der Prüfungen ist die Reihenfolge, in der der
  // Anlagelauf selbst scheitern würde.
  if (spalten.length < 4) {
    zeilen.push(
      `Fazit: Anlegen nicht möglich — nur ${spalten.length} von vier Spalten. ` +
        'Es fehlen Spalten für Halle, Regal, Ebene oder Feld.',
    );
  } else if (antwort.vollstaendig === false) {
    zeilen.push(
      'Fazit: Die Knotenliste war nicht vollständig lesbar. Bitte noch einmal prüfen — ' +
        'auf halber Liste wird nicht angelegt, sonst entstehen doppelte Felder.',
    );
  } else if (!oberste.length) {
    zeilen.push(
      'Fazit: Die vier Spalten stehen, es gibt aber noch keinen einzigen Knoten. ' +
        'Der Lauf legt die erste Halle unter der Wurzel 0 an — so hängen sie auch ' +
        'in Burlo. Lehnt Plenty das ab, bricht die erste Zeile ab und sonst nichts; ' +
        'dann eine Halle von Hand anlegen und erneut starten.',
    );
  } else {
    zeilen.push('Fazit: Die vier Spalten stehen und eine Wurzel ist da — Anlegen ist möglich.');
  }

  zeilen.push(
    'Die Haken „Position für Laufweg berücksichtigen" stehen oben als Ja/Nein-Felder, ' +
      'sofern die API sie mitschickt. Kommt dort nichts, heißt das nicht „Haken fehlt", ' +
      'sondern nur: die Schnittstelle gibt ihn nicht heraus — dann im Backend nachsehen.',
  );
  return zeilen;
}

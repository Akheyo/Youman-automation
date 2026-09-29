/**
 * Fehlerantworten von Marktplaats lesbar machen.
 *
 * Reine Auswertung, kein Netz — deshalb testbar ohne API-Zugang, was hier
 * besonders zählt: Genau diese Pfade laufen im Ernstfall, und genau sie
 * bekommt man bei einem Probelauf mit gültigen Daten nie zu sehen.
 *
 * Die API antwortet bei einer fehlgeschlagenen Prüfung mit `400` und „an error
 * response which contains a list of the errors". Die genaue Form dieser Liste
 * ist nicht dokumentiert. Deshalb wird hier **nachsichtig** gelesen: mehrere
 * gebräuchliche Schreibweisen der Schlüssel werden akzeptiert, und was sich
 * nicht zuordnen lässt, landet als Rohtext im Ergebnis statt verloren zu
 * gehen. Ein Fehler, den man nicht versteht, ist immer noch besser als ein
 * Fehler, den man nicht sieht.
 *
 * Ein Feldfehler ist dabei mehr als eine Meldung: `input-too-long` bringt die
 * erlaubte Länge mit. Die Titelgrenze steht nirgends in der Dokumentation —
 * die API ist die einzige Quelle, und hier wird sie ausgelesen.
 */

export interface Feldfehler {
  feld: string;
  code: string;
  meldung: string;
  /** Der „error value" — bei Längenfehlern die erlaubte Länge. */
  wert: string | null;
}

export interface Fehlerbefund {
  /** HTTP-Status der Antwort. */
  status: number;
  /** Der API-Fehlercode, z. B. „validation-failure". */
  code: string | null;
  meldung: string;
  felder: Feldfehler[];
  /** Die Antwort, gekürzt — für den Fall, dass nichts davon passte. */
  roh: string;
}

function text(wert: unknown): string | null {
  if (typeof wert === 'string' && wert.trim()) return wert.trim();
  if (typeof wert === 'number') return String(wert);
  return null;
}

function ersterTreffer(obj: Record<string, unknown>, schluessel: string[]): string | null {
  for (const s of schluessel) {
    const t = text(obj[s]);
    if (t) return t;
  }
  return null;
}

/** Zieht die Feldfehler aus einer beliebig verschachtelten Antwort. */
function sammleFelder(knoten: unknown, aus: Feldfehler[] = []): Feldfehler[] {
  if (Array.isArray(knoten)) {
    for (const eintrag of knoten) sammleFelder(eintrag, aus);
    return aus;
  }
  if (!knoten || typeof knoten !== 'object') return aus;

  const obj = knoten as Record<string, unknown>;
  const feld = ersterTreffer(obj, ['fieldName', 'field', 'name', 'path']);
  const code = ersterTreffer(obj, ['code', 'errorCode', 'error']);
  if (feld && code) {
    aus.push({
      feld,
      code,
      meldung: ersterTreffer(obj, ['message', 'description', 'detail']) ?? code,
      wert: ersterTreffer(obj, ['value', 'errorValue', 'allowedValue']),
    });
  }

  // Auch in Unterlisten schauen: fieldErrors, errors, details — je nach Fall
  // hängen die Feldfehler an einer anderen Stelle.
  for (const schluessel of ['fieldErrors', 'fieldError', 'errors', 'details', 'validationErrors']) {
    if (schluessel in obj) sammleFelder(obj[schluessel], aus);
  }
  return aus;
}

/**
 * Liest eine Fehlerantwort.
 *
 * `roh` ist der Antwortkörper als Text. Ist er kein JSON (ein HTML-Fehlerblatt
 * vom Lastverteiler zum Beispiel), kommt er als Meldung zurück — gekürzt, weil
 * sonst eine halbe Webseite im Protokoll steht.
 */
export function leseFehler(status: number, roh: string): Fehlerbefund {
  const gekuerzt = (roh ?? '').slice(0, 500);
  let daten: unknown = null;
  try {
    daten = JSON.parse(roh);
  } catch {
    return {
      status,
      code: null,
      meldung: gekuerzt.trim() || `HTTP ${status} ohne Antworttext.`,
      felder: [],
      roh: gekuerzt,
    };
  }

  const obj = (daten && typeof daten === 'object' ? daten : {}) as Record<string, unknown>;
  const felder = sammleFelder(daten);
  const code = ersterTreffer(obj, ['code', 'errorCode', 'error']);
  const meldung =
    ersterTreffer(obj, ['message', 'description', 'error_description', 'detail']) ??
    code ??
    `HTTP ${status}`;

  return { status, code, meldung, felder, roh: gekuerzt };
}

/**
 * Ein Satz, den jemand im Büro lesen kann.
 *
 * Die Feldfehler sind das Wertvolle — „categoryId: category-not-found" sagt,
 * was zu tun ist; „HTTP 400" sagt nichts.
 */
export function fehlerText(b: Fehlerbefund): string {
  const teile: string[] = [];
  teile.push(b.code ? `${b.code} (HTTP ${b.status})` : `HTTP ${b.status}`);
  if (b.meldung && b.meldung !== b.code) teile.push(b.meldung);
  for (const f of b.felder) {
    teile.push(`Feld ${f.feld}: ${f.code}${f.wert ? ` (erlaubt: ${f.wert})` : ''} — ${f.meldung}`);
  }
  return teile.join(' · ');
}

/**
 * Die erlaubte Titellänge aus einem `input-too-long` für das Titelfeld.
 *
 * Marktplaats dokumentiert keine Titelgrenze, liefert sie bei Überschreitung
 * aber als „error value" mit. Wer sie ausliest, muss sie nicht raten — und
 * der nächste Versuch geht durch, statt denselben Fehler zu wiederholen.
 *
 * Der Feldname ist je nach Antwort `title` oder `translations[0].title`;
 * beides zählt.
 */
export function titelGrenzeAus(b: Fehlerbefund): number | null {
  for (const f of b.felder) {
    if (!/title/i.test(f.feld)) continue;
    if (f.code !== 'input-too-long') continue;
    const zahl = Number((f.wert ?? '').replace(/[^0-9]/g, ''));
    if (Number.isFinite(zahl) && zahl > 0) return zahl;
  }
  return null;
}

/** Der Artikel ist bei Marktplaats nicht (mehr) vorhanden. */
export function istUnbekannteAnzeige(b: Fehlerbefund): boolean {
  return b.status === 404 || b.code === 'advertisement-not-found';
}

/**
 * Lohnt ein zweiter Versuch?
 *
 * Nur bei Störungen auf der Gegenseite und bei Drosselung. Ein `400` kommt
 * beim Wiederholen genauso zurück — das wäre nur Zeit und Kontingent.
 */
export function lohntWiederholung(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

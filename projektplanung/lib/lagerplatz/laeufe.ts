/**
 * Läufe in einzelne Lagerplatz-Codes auflösen.
 *
 * Ein „Lauf" ist eine Zeile aus der Anlege-Tabelle und entspricht genau einem
 * Durchgang durch die Plenty-Maske „Neue Lagerorte anlegen":
 *
 *     Nr   Halle  Regal  Ebene  Feld    Lagerort
 *     43   1      7      A      16-17   K 1-48
 *
 * Gelesen: Halle 1, Regal 7, Ebene A, Felder 16 bis 17, darin je die Kisten
 * K01 bis K48 — also 96 Lagerorte. "0" statt "K 1-48" heißt: nur der
 * Stellplatz selbst, ohne Kisten.
 *
 * Der Leser ist absichtlich großzügig: Spalten dürfen durch Leerzeichen,
 * Tabulatoren, Semikolon oder senkrechte Striche getrennt sein, eine führende
 * laufende Nummer darf dabeistehen oder fehlen. Was er nicht sicher lesen
 * kann, meldet er als Fehler — geraten wird nichts.
 */

/** Ein Lauf, so wie er in der Tabelle steht. */
export interface Lauf {
  halle: number;
  /** Regal — kann Buchstaben enthalten, z. B. "8KTL". */
  regal: string;
  /** Ebene ohne führendes E, z. B. "A". */
  ebene: string;
  vonFach: number;
  bisFach: number;
  /** Präfix des Lagerorts, meist "K". Leer = reiner Stellplatz. */
  praefix: string;
  vonOrt: number;
  bisOrt: number;
}

/** Wie viele Lagerorte dieser Lauf erzeugt. */
export function anzahlAus(lauf: Lauf): number {
  const faecher = lauf.bisFach - lauf.vonFach + 1;
  const orte = lauf.bisOrt - lauf.vonOrt + 1;
  return Math.max(0, faecher) * Math.max(0, orte);
}

/** Zerlegt "16-17" oder "16" in einen Bereich. */
function bereich(text: string): [number, number] | null {
  const m = text.match(/^(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?$/);
  if (!m) return null;
  const von = Number(m[1]);
  const bis = m[2] === undefined ? von : Number(m[2]);
  if (bis < von) return null;
  return [von, bis];
}

/**
 * Liest eine einzelne Tabellenzeile. Gibt null zurück, wenn die Zeile leer
 * ist oder eine Überschrift, und wirft nicht — Fehler meldet `leseLaeufe`.
 */
export function leseLauf(zeile: string): { lauf: Lauf } | { fehler: string } | null {
  const roh = zeile.trim();
  if (!roh) return null;
  if (/^(nr|halle)\b/i.test(roh)) return null; // Überschrift
  if (/^[-=_\s|]+$/.test(roh)) return null; // Trennlinie

  // Spalten trennen: | ; Tab oder mehrere Leerzeichen. Einfache Leerzeichen
  // innerhalb einer Spalte ("K 1-36") bleiben so erhalten.
  let felder = roh
    .split(/\s*[|;\t]\s*|\s{2,}/)
    .map((f) => f.trim())
    .filter(Boolean);

  // Notfalls doch an einfachen Leerzeichen trennen und "K 1-36" wieder
  // zusammensetzen — so lässt sich auch eine eng getippte Zeile lesen. Nur
  // dann, wenn die Zeile gar kein eigenes Trennzeichen mitbringt; sonst würde
  // aus "1 | 7 | A" durch die Striche eine scheinbar vollständige Zeile.
  if (felder.length < 5 && !/[|;\t]/.test(roh)) {
    const teile = roh.split(/\s+/).filter(Boolean);
    felder = [];
    for (let i = 0; i < teile.length; i++) {
      if (/^[A-Z]$/i.test(teile[i]) && /^\d/.test(teile[i + 1] ?? '') && i === teile.length - 2) {
        felder.push(`${teile[i]} ${teile[i + 1]}`);
        i += 1;
      } else {
        felder.push(teile[i]);
      }
    }
  }

  // Führende laufende Nummer abwerfen, wenn dadurch fünf Spalten bleiben.
  if (felder.length === 6 && /^\d{1,3}\.?$/.test(felder[0])) felder = felder.slice(1);
  if (felder.length !== 5) {
    return { fehler: `"${roh}" — erwartet werden fünf Spalten (Halle, Regal, Ebene, Feld, Lagerort).` };
  }

  const [sHalle, sRegal, sEbene, sFach, sOrt] = felder;

  const halle = Number(sHalle.replace(/^H/i, ''));
  if (!Number.isInteger(halle) || halle < 1 || halle > 20) {
    return { fehler: `"${roh}" — Halle "${sHalle}" nicht lesbar.` };
  }

  const regal = sRegal.replace(/^R/i, '').toUpperCase();
  if (!/^\d{1,2}(KTL)?$|^KTL$/.test(regal)) {
    return { fehler: `"${roh}" — Regal "${sRegal}" nicht lesbar.` };
  }

  // Erst prüfen, dann abschneiden: Ebene "E" ist selbst gültig, und ein
  // blindes Entfernen des Präfixes würde ausgerechnet sie zu nichts machen.
  const roheEbene = sEbene.toUpperCase();
  const ebene = /^[A-J]Z?$/.test(roheEbene) ? roheEbene : roheEbene.replace(/^E/, '');
  if (!/^[A-J]Z?$/.test(ebene)) {
    return { fehler: `"${roh}" — Ebene "${sEbene}" nicht lesbar (erwartet A bis J).` };
  }

  const faecher = bereich(sFach.replace(/^F/i, ''));
  if (!faecher) return { fehler: `"${roh}" — Feld "${sFach}" nicht lesbar.` };

  // Lagerort: "0" (kein Präfix) oder "K 1-36" / "K1-36".
  const ortRoh = sOrt.trim();
  let praefix = '';
  let orte: [number, number] | null;
  const mitPraefix = ortRoh.match(/^([A-Z])\s*(.+)$/i);
  if (mitPraefix) {
    praefix = mitPraefix[1].toUpperCase();
    orte = bereich(mitPraefix[2].trim());
  } else {
    orte = bereich(ortRoh);
  }
  if (!orte) return { fehler: `"${roh}" — Lagerort "${sOrt}" nicht lesbar (erwartet "0" oder "K 1-36").` };

  return { lauf: { halle, regal, ebene, vonFach: faecher[0], bisFach: faecher[1], praefix, vonOrt: orte[0], bisOrt: orte[1] } };
}

/** Liest eine ganze Tabelle. Fehlerhafte Zeilen werden benannt, nicht geraten. */
export function leseLaeufe(text: string): { laeufe: Lauf[]; fehler: string[] } {
  const laeufe: Lauf[] = [];
  const fehler: string[] = [];
  for (const zeile of text.split(/\r?\n/)) {
    const res = leseLauf(zeile);
    if (!res) continue;
    if ('fehler' in res) fehler.push(res.fehler);
    else laeufe.push(res.lauf);
  }
  return { laeufe, fehler };
}

/**
 * Löst einen Lauf in die einzelnen Codes auf — in derselben Schreibweise, die
 * auch aus der Erkennung kommt ("H1/R7/EA F16-K04").
 */
export function codesAus(lauf: Lauf): string[] {
  const codes: string[] = [];
  for (let f = lauf.vonFach; f <= lauf.bisFach; f++) {
    const fach = String(f).padStart(2, '0');
    for (let o = lauf.vonOrt; o <= lauf.bisOrt; o++) {
      // Ohne Präfix ist es der reine Stellplatz; der heißt in Plenty "-0".
      const ort = lauf.praefix ? `${lauf.praefix}${String(o).padStart(2, '0')}` : String(o);
      codes.push(`H${lauf.halle}/R${lauf.regal}/E${lauf.ebene} F${fach}-${ort}`);
    }
  }
  return codes;
}

/**
 * Löst eine ganze Tabelle auf und wirft dabei Dubletten heraus — mehrere
 * Läufe dürfen sich überschneiden, jeder Lagerort soll aber nur einmal
 * entstehen. Die Reihenfolge bleibt die der Tabelle.
 */
export function codesAusTabelle(text: string): { codes: string[]; laeufe: number; fehler: string[]; doppelt: number } {
  const { laeufe, fehler } = leseLaeufe(text);
  const gesehen = new Set<string>();
  const codes: string[] = [];
  let doppelt = 0;
  for (const lauf of laeufe) {
    for (const code of codesAus(lauf)) {
      if (gesehen.has(code)) {
        doppelt += 1;
        continue;
      }
      gesehen.add(code);
      codes.push(code);
    }
  }
  return { codes, laeufe: laeufe.length, fehler, doppelt };
}

// ===========================================================================
// Lagerplatz-Erkennung für einen n8n Code-Knoten
// Modus: "Run Once for All Items"
//
// Erwartet Datensätze mit Textfeldern und sucht darin Lagerplatz-Codes wie
// H6R5A7 (Halle 6, Regal 5, Ablage 7). Verändert nichts — es wird nur gelesen
// und bewertet.
//
// Eingang: beliebige Felder. Welche durchsucht werden, steht in FELDER.
// Ausgang: ein Datensatz je Eingang, mit code, klartext, sicherheit, fundort.
//
// Diese Datei ist die 1:1-Übertragung der geprüften Logik aus
// projektplanung/lib/lagerplatz/erkennung.ts.
// ===========================================================================

// --- Anpassen: welche Felder durchsucht werden, in dieser Reihenfolge ------
const FELDER = ['variantennummer', 'modell', 'externe_id', 'name', 'beschreibung'];

// --- Anpassen: welche Felder unverändert mitgenommen werden ----------------
const MITNEHMEN = ['varianten_id', 'artikel_id', 'variantennummer', 'name', 'bestand'];

// ---------------------------------------------------------------------------
// Vokabular
// ---------------------------------------------------------------------------
const SCHLUESSEL = {
  H: 'Halle', L: 'Lager', G: 'Gang', Z: 'Zeile', R: 'Regal', E: 'Ebene',
  F: 'Fach', A: 'Ablage', B: 'Boden', P: 'Platz', C: 'Container',
  K: 'Kiste', S: 'Stellplatz',
};

// Kürzel, die genauso gut eine Maßangabe sein können.
const MASS_SCHLUESSEL = new Set(['L', 'B', 'H', 'T', 'D', 'W']);

// Wörter, die den Code nur ankündigen.
const ETIKETTEN = ['LAGERPLAETZE', 'LAGERPLATZ', 'LAGERORT', 'STELLPLATZ', 'STANDORT', 'LAGERFACH'];

// Ausgeschriebene Ebenen. Längere zuerst, sonst frisst LAGER den Anfang
// von LAGERPLATZ.
const WORTE = [
  ['LAGERHALLE', 'H'], ['HALLE', 'H'], ['CONTAINER', 'C'], ['STELLAGE', 'R'],
  ['REGAL', 'R'], ['REIHE', 'R'], ['ABLAGE', 'A'], ['ABTEIL', 'A'],
  ['EBENE', 'E'], ['BODEN', 'B'], ['FACH', 'F'], ['GANG', 'G'],
  ['ZEILE', 'Z'], ['KISTE', 'K'], ['PLATZ', 'P'], ['LAGER', 'L'],
];

const MUSTER = /(?<![A-Z0-9])((?:[A-Z][\s._/-]{0,2}\d{1,3}[\s._/-]{0,2}){2,5})(?![A-Z0-9])/g;

// ---------------------------------------------------------------------------
function normalisiere(text) {
  return (text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS');
}

function vereinheitliche(text) {
  let out = normalisiere(text);
  for (const wort of ETIKETTEN) {
    out = out.replace(new RegExp('\\b' + wort + '\\b', 'g'), ' ');
  }
  for (const [wort, kuerzel] of WORTE) {
    // Nur ersetzen, wenn direkt danach eine Zahl folgt ("Regal 5"), damit
    // Fließtext wie "im Lager gefunden" keine Segmente erzeugt.
    out = out.replace(new RegExp('\\b' + wort + '\\b(?=[\\s.:_/-]*\\d)', 'g'), ' ' + kuerzel + ' ');
  }
  return out;
}

function zerlege(roh) {
  const segmente = [];
  for (const m of roh.matchAll(/([A-Z])[\s._/-]{0,2}(\d{1,3})/g)) {
    segmente.push({ schluessel: m[1], nummer: Number(m[2]) });
  }
  return segmente;
}

function codeAus(segmente) {
  return segmente.map((s) => s.schluessel + s.nummer).join('');
}

function klartextAus(segmente) {
  return segmente.map((s) => (SCHLUESSEL[s.schluessel] ?? s.schluessel) + ' ' + s.nummer).join(' · ');
}

function bewerte(segmente) {
  const schluessel = segmente.map((s) => s.schluessel);
  const unbekannt = schluessel.filter((k) => !(k in SCHLUESSEL));
  const doppelt = schluessel.length !== new Set(schluessel).size;

  // "L120B60H90" sieht aus wie ein Lagerplatz, ist aber ein Karton.
  const nurMass = schluessel.every((k) => MASS_SCHLUESSEL.has(k));
  const grosseZahlen = segmente.filter((s) => s.nummer >= 10).length;
  if (nurMass && grosseZahlen >= 2) {
    return { sicherheit: 'ignoriert', grund: 'sieht nach Maßangabe aus (Länge/Breite/Höhe)' };
  }
  if (segmente.length < 3) return { sicherheit: 'unsicher', grund: 'nur zwei Ebenen erkannt' };
  if (unbekannt.length) return { sicherheit: 'unsicher', grund: 'unbekannte Ebene „' + unbekannt.join(', ') + '“' };
  if (doppelt) return { sicherheit: 'unsicher', grund: 'dieselbe Ebene kommt mehrfach vor' };
  return { sicherheit: 'sicher', grund: null };
}

function findeLagerplaetze(text) {
  if (!text || !String(text).trim()) return [];
  const vorbereitet = vereinheitliche(String(text));
  const gefunden = new Map();

  for (const m of vorbereitet.matchAll(MUSTER)) {
    const segmente = zerlege(m[1]);
    if (segmente.length < 2) continue;
    const code = codeAus(segmente);
    if (gefunden.has(code)) continue;
    const { sicherheit, grund } = bewerte(segmente);
    gefunden.set(code, {
      code,
      roh: m[1].trim().replace(/\s+/g, ' '),
      segmente,
      sicherheit,
      grund,
      klartext: klartextAus(segmente),
    });
  }
  return [...gefunden.values()];
}

function besterTreffer(treffer) {
  const rang = (t) => (t.sicherheit === 'sicher' ? 2 : 1);
  const brauchbar = treffer.filter((t) => t.sicherheit !== 'ignoriert');
  if (!brauchbar.length) return null;
  return brauchbar.reduce((a, b) => {
    if (rang(b) !== rang(a)) return rang(b) > rang(a) ? b : a;
    return b.segmente.length > a.segmente.length ? b : a;
  });
}

// ---------------------------------------------------------------------------
// Eine Variante bewerten: alle Felder durchsuchen, Widersprüche erkennen
// ---------------------------------------------------------------------------
function bewerteVariante(daten) {
  const proFeld = [];

  for (const feld of FELDER) {
    const wert = daten[feld];
    if (!wert) continue;
    const beste = besterTreffer(findeLagerplaetze(wert));
    if (beste) proFeld.push({ feld, ...beste });
  }

  const codes = [...new Set(proFeld.map((t) => t.code))];

  if (proFeld.length === 0) {
    return { befund: 'ohne_platz', code: null, klartext: null, sicherheit: null,
             grund: 'in keinem Feld ein Lagerplatz gefunden', fundort: null, roh: null, alle_codes: [] };
  }

  if (codes.length > 1) {
    // Zwei verschiedene Plätze genannt - das entscheidet ein Mensch.
    return { befund: 'widerspruch', code: null, klartext: null, sicherheit: 'unsicher',
             grund: 'verschiedene Plätze genannt: ' + codes.join(', '),
             fundort: proFeld.map((t) => t.feld).join(', '), roh: proFeld.map((t) => t.roh).join(' | '),
             alle_codes: codes };
  }

  const t = proFeld[0];
  return {
    befund: t.sicherheit === 'sicher' ? 'sicher' : 'unsicher',
    code: t.code, klartext: t.klartext, sicherheit: t.sicherheit,
    grund: t.grund, fundort: t.feld, roh: t.roh, alle_codes: codes,
  };
}

// ---------------------------------------------------------------------------
// n8n-Einstieg
// ---------------------------------------------------------------------------
return items.map((item) => {
  const daten = item.json;
  const ergebnis = bewerteVariante(daten);

  const uebernommen = {};
  for (const feld of MITNEHMEN) {
    if (feld in daten) uebernommen[feld] = daten[feld];
  }

  return { json: { ...uebernommen, ...ergebnis } };
});

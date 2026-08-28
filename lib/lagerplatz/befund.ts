/**
 * Aus den Rohdaten einer Plenty-Variante einen Lagerplatz-Befund machen.
 *
 * Geprüft werden mehrere Felder, in dieser Reihenfolge (das erste sichere
 * Ergebnis gewinnt): Variantennummer → Modell → Externe ID → Variantenname →
 * Artikel-/Variantenbeschreibung. Widersprechen sich zwei Felder, wird das als
 * „Konflikt" ausgewiesen statt still eines der beiden zu nehmen.
 */

import { besterTreffer, findeLagerplaetze, type LagerplatzTreffer, type Sicherheit } from './erkennung';

/** Rohdaten einer Variante, so wie der Scan sie aus Plenty liest. */
export interface VariantenRohdaten {
  variationId: number;
  itemId: number;
  nummer?: string | null;
  modell?: string | null;
  externeId?: string | null;
  name?: string | null;
  beschreibung?: string | null;
  /** Verfügbarer Bestand (netStock), sofern der Scan ihn kennt. */
  bestand?: number | null;
  /** Physisch vorhandener Bestand (physicalStock). */
  bestandPhysisch?: number | null;
  /** Lager, in denen der Artikel liegt (Namen oder IDs, kommagetrennt). */
  lager?: string | null;
}

export type BefundStatus = 'gefunden' | 'unsicher' | 'konflikt' | 'kein-treffer';

/** Ein Kandidat: ein Treffer samt Feld, aus dem er stammt. */
export interface Kandidat {
  feld: string;
  code: string;
  roh: string;
  sicherheit: Sicherheit;
  grund: string | null;
  klartext: string;
}

/** Das Ergebnis für genau eine Variante. */
export interface Befund {
  variationId: number;
  itemId: number;
  nummer: string | null;
  name: string | null;
  /** Vorgeschlagener Lagerplatz — null, wenn nichts Brauchbares gefunden wurde. */
  code: string | null;
  klartext: string | null;
  /** Feld, aus dem der Vorschlag stammt. */
  quelle: string | null;
  status: BefundStatus;
  hinweis: string | null;
  kandidaten: Kandidat[];
  bestand: number | null;
  bestandPhysisch: number | null;
  lager: string | null;
}

/** Felder in der Reihenfolge ihrer Verlässlichkeit. */
const FELDER: Array<{ feld: string; lies: (v: VariantenRohdaten) => string | null | undefined }> = [
  { feld: 'Variantennummer', lies: (v) => v.nummer },
  { feld: 'Modell', lies: (v) => v.modell },
  { feld: 'Externe ID', lies: (v) => v.externeId },
  { feld: 'Name', lies: (v) => v.name },
  { feld: 'Beschreibung', lies: (v) => v.beschreibung },
];

function alsKandidat(feld: string, t: LagerplatzTreffer): Kandidat {
  return { feld, code: t.code, roh: t.roh, sicherheit: t.sicherheit, grund: t.grund, klartext: t.klartext };
}

/** Wertet eine Variante aus. Wirft nie. */
export function bewerteVariante(v: VariantenRohdaten): Befund {
  const kandidaten: Kandidat[] = [];
  let vorschlag: { feld: string; treffer: LagerplatzTreffer } | null = null;

  for (const { feld, lies } of FELDER) {
    const text = lies(v);
    if (!text) continue;
    const treffer = findeLagerplaetze(String(text));
    for (const t of treffer) kandidaten.push(alsKandidat(feld, t));
    const bester = besterTreffer(treffer);
    if (!bester) continue;
    // Ein sicherer Treffer aus einem verlässlicheren Feld wird nicht mehr
    // überschrieben; ein unsicherer darf später von einem sicheren abgelöst
    // werden.
    if (!vorschlag) vorschlag = { feld, treffer: bester };
    else if (vorschlag.treffer.sicherheit !== 'sicher' && bester.sicherheit === 'sicher') {
      vorschlag = { feld, treffer: bester };
    }
  }

  const basis = {
    variationId: v.variationId,
    itemId: v.itemId,
    nummer: v.nummer ?? null,
    name: v.name ?? null,
    kandidaten,
    bestand: v.bestand ?? null,
    bestandPhysisch: v.bestandPhysisch ?? null,
    lager: v.lager ?? null,
  };

  if (!vorschlag) {
    const nurMasse = kandidaten.length > 0 && kandidaten.every((k) => k.sicherheit === 'ignoriert');
    return {
      ...basis,
      code: null,
      klartext: null,
      quelle: null,
      status: 'kein-treffer',
      hinweis: nurMasse ? 'nur Maßangaben gefunden' : null,
    };
  }

  // Widersprechen sich zwei belastbare Felder?
  const sichereCodes = [
    ...new Set(kandidaten.filter((k) => k.sicherheit === 'sicher').map((k) => k.code)),
  ];
  const konflikt = sichereCodes.length > 1;

  return {
    ...basis,
    code: vorschlag.treffer.code,
    klartext: vorschlag.treffer.klartext,
    quelle: vorschlag.feld,
    status: konflikt ? 'konflikt' : vorschlag.treffer.sicherheit === 'sicher' ? 'gefunden' : 'unsicher',
    hinweis: konflikt
      ? `widersprüchliche Angaben: ${sichereCodes.join(' / ')}`
      : vorschlag.treffer.grund,
  };
}

/** Zusammenfassung über viele Befunde — Basis für die Vorschau-Kopfzeile. */
export interface Zusammenfassung {
  gesamt: number;
  gefunden: number;
  unsicher: number;
  konflikt: number;
  ohneTreffer: number;
  /** Alle verschiedenen Lagerplätze mit ihrer Artikelzahl, größte zuerst. */
  plaetze: Array<{ code: string; klartext: string; anzahl: number }>;
}

export function fasseZusammen(befunde: Befund[]): Zusammenfassung {
  const plaetze = new Map<string, { code: string; klartext: string; anzahl: number }>();
  let gefunden = 0;
  let unsicher = 0;
  let konflikt = 0;
  let ohneTreffer = 0;

  for (const b of befunde) {
    if (b.status === 'gefunden') gefunden += 1;
    else if (b.status === 'unsicher') unsicher += 1;
    else if (b.status === 'konflikt') konflikt += 1;
    else ohneTreffer += 1;

    if (b.code && b.status !== 'kein-treffer') {
      const vorhanden = plaetze.get(b.code);
      if (vorhanden) vorhanden.anzahl += 1;
      else plaetze.set(b.code, { code: b.code, klartext: b.klartext ?? b.code, anzahl: 1 });
    }
  }

  return {
    gesamt: befunde.length,
    gefunden,
    unsicher,
    konflikt,
    ohneTreffer,
    plaetze: [...plaetze.values()].sort((a, b) => b.anzahl - a.anzahl || a.code.localeCompare(b.code)),
  };
}

/** CSV-Zeilen für den Export (Semikolon — Excel/DE-freundlich). */
export function alsCsv(befunde: Befund[]): string {
  const feld = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kopf = [
    'Variante-ID', 'Artikel-ID', 'Variantennummer', 'Name', 'Bestand', 'Bestand physisch', 'Lager',
    'Lagerplatz', 'Klartext', 'Quelle', 'Status', 'Hinweis',
  ];
  const zeilen = befunde.map((b) =>
    [b.variationId, b.itemId, b.nummer, b.name, b.bestand, b.bestandPhysisch, b.lager,
     b.code, b.klartext, b.quelle, b.status, b.hinweis]
      .map(feld)
      .join(';'),
  );
  return [kopf.join(';'), ...zeilen].join('\r\n');
}

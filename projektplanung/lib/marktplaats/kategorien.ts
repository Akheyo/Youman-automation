/**
 * Marktplaats-Kategorien: einlesen, durchsuchen, zuordnen.
 *
 * Eine Anzeige braucht eine **L2-Kategorie** — L1 gruppiert nur, dort lässt
 * sich nichts einstellen. Und sie braucht eine *offene*: Marktplaats schließt
 * Kategorien, ohne sie zu entfernen; in einer geschlossenen wird die Anzeige
 * abgewiesen.
 *
 * WARUM DIE ZUORDNUNG NICHT GERATEN WIRD: Die Kategorien heißen auf
 * Niederländisch („Gereedschap | Boormachines"), das Plenty-Sortiment ist
 * deutsch, und zwischen beiden liegt keine Regel, sondern eine Entscheidung.
 * Ein Ähnlichkeitsmaß, das „Schleifmaschine" auf „Slijpmachines" schiebt,
 * schiebt „Kabelbinder" genauso zuversichtlich auf „Kabelhaspels" — und
 * niemand sieht es, weil die Anzeige ja erscheint.
 *
 * Deshalb: `findeVorschlaege` **schlägt vor**, entschieden wird in einer
 * Tabelle, die jemand pflegt. Was nicht zugeordnet ist, bleibt liegen und
 * wird gezählt — eine Lücke, die man sieht, statt einer Anzeige in der
 * falschen Rubrik.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { aufruf } from './client';

export interface Kategorie {
  /** L2-Kategorie-ID — die, die in die Anzeige gehört. */
  id: number;
  /** Name, wie Marktplaats ihn führt, z. B. „Antiek | Bestek". */
  name: string;
  l1Id: number | null;
  l1Name: string | null;
  /** Nur offene Kategorien nehmen Anzeigen an. */
  offen: boolean;
}

// ---------------------------------------------------------------------------
// Die Antwort der API auseinandernehmen
// ---------------------------------------------------------------------------

interface RohKategorie {
  categoryId?: number;
  name?: string;
  labels?: Record<string, string>;
  status?: string;
  _embedded?: Record<string, unknown>;
}

/**
 * Macht aus der verschachtelten HAL-Antwort eine flache Liste der
 * L2-Kategorien.
 *
 * Die Antwort hängt die Unterkategorien unter `_embedded`, und der Schlüssel
 * dort heißt je nach Aufruf anders (`mp:category`, `mp:categories`). Statt
 * einen Namen zu raten, wird jede eingebettete Liste durchgegangen: Was
 * selbst Kinder hat, ist L1; was keine hat, ist L2.
 */
export function flacheListe(antwort: unknown): Kategorie[] {
  const aus: Kategorie[] = [];

  const kinder = (knoten: RohKategorie): RohKategorie[] => {
    const raus: RohKategorie[] = [];
    for (const wert of Object.values(knoten._embedded ?? {})) {
      if (Array.isArray(wert)) {
        for (const eintrag of wert) {
          if (eintrag && typeof eintrag === 'object' && 'categoryId' in eintrag) raus.push(eintrag as RohKategorie);
        }
      } else if (wert && typeof wert === 'object' && 'categoryId' in (wert as object)) {
        raus.push(wert as RohKategorie);
      }
    }
    return raus;
  };

  const gehe = (knoten: RohKategorie, l1: RohKategorie | null): void => {
    const eigene = kinder(knoten);
    if (eigene.length > 0) {
      // Hat Kinder → das ist eine Ebene darüber. Weiter nach unten.
      for (const kind of eigene) gehe(kind, knoten.categoryId ? knoten : l1);
      return;
    }
    const id = Number(knoten.categoryId);
    if (!Number.isFinite(id) || id <= 0) return;
    aus.push({
      id,
      name: knoten.labels?.['nl-NL'] ?? knoten.name ?? String(id),
      l1Id: l1?.categoryId ?? null,
      l1Name: l1 ? l1.labels?.['nl-NL'] ?? l1.name ?? null : null,
      // Fehlt der Status, gilt die Kategorie als offen — die API liefert ihn
      // nicht überall mit, und alles auf „geschlossen" zu setzen legte den
      // ganzen Abgleich lahm.
      offen: (knoten.status ?? 'open').toLowerCase() === 'open',
    });
  };

  const wurzel = (antwort ?? {}) as RohKategorie;
  gehe(wurzel, null);

  // Dieselbe Kategorie kann über zwei Wege erreichbar sein.
  const gesehen = new Set<number>();
  return aus.filter((k) => (gesehen.has(k.id) ? false : (gesehen.add(k.id), true)));
}

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

/** Kleinschreibung, Umlaute und Akzente weg, Trennzeichen zu Leerzeichen. */
export function normalisiere(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function woerter(text: string): string[] {
  return normalisiere(text).split(' ').filter((w) => w.length >= 3);
}

export interface Vorschlag {
  kategorie: Kategorie;
  /** 0 bis 1. Nur ein Anhaltspunkt, keine Entscheidung. */
  guete: number;
}

/**
 * Schlägt Kategorien zu einem Suchbegriff vor.
 *
 * Bewusst schlicht: Wortüberschneidung plus ein Bonus für einen enthaltenen
 * Begriff. Etwas Ausgefeilteres würde eine Genauigkeit vortäuschen, die
 * zwischen zwei Sprachen ohne Wörterbuch nicht zu haben ist — und der Punkt
 * dieser Funktion ist, jemandem die Auswahl zu verkürzen, nicht sie zu
 * ersetzen.
 */
export function findeVorschlaege(begriff: string, liste: Kategorie[], anzahl = 5): Vorschlag[] {
  const gesucht = woerter(begriff);
  if (!gesucht.length) return [];

  const bewertet = liste
    .filter((k) => k.offen)
    .map((k) => {
      const ziel = normalisiere(`${k.l1Name ?? ''} ${k.name}`);
      const zielWoerter = ziel.split(' ').filter(Boolean);
      let treffer = 0;
      for (const w of gesucht) {
        if (zielWoerter.includes(w)) treffer += 1;
        else if (ziel.includes(w)) treffer += 0.5;
      }
      return { kategorie: k, guete: treffer / gesucht.length };
    })
    .filter((v) => v.guete > 0);

  bewertet.sort((a, b) => b.guete - a.guete || a.kategorie.name.localeCompare(b.kategorie.name));
  return bewertet.slice(0, anzahl);
}

// ---------------------------------------------------------------------------
// Aus der API holen
// ---------------------------------------------------------------------------

/**
 * Liest den Kategoriebaum bei Marktplaats.
 *
 * Erst den ganzen Baum auf einmal versuchen. Liefert der Aufruf nur die
 * L1-Ebene (das kommt vor, weil die Antwort sonst sehr groß würde), wird je
 * L1-Kategorie nachgeladen. Das ist derselbe Umgang wie beim Plenty-Scan
 * nebenan: erst probieren, dann nach dem Ergebnis handeln, statt eine Form
 * vorauszusetzen.
 */
export async function holeKategorien(): Promise<{ kategorien: Kategorie[]; diagnose: string[] }> {
  const diagnose: string[] = [];
  const wurzel = await aufruf<unknown>({ methode: 'GET', pfad: '/v2/categories' });
  let kategorien = flacheListe(wurzel.daten);
  diagnose.push(`/v2/categories lieferte ${kategorien.length} Kategorien ohne Unterebene.`);

  // Kamen nur L1-Kategorien zurück (keine hat eine Elternkategorie), dann ist
  // das die oberste Ebene und die eigentlichen Ziele fehlen noch.
  const nurL1 = kategorien.length > 0 && kategorien.every((k) => k.l1Id === null);
  if (nurL1) {
    diagnose.push('Nur die oberste Ebene erhalten — Unterkategorien werden einzeln nachgeladen.');
    const zusammen: Kategorie[] = [];
    for (const l1 of kategorien) {
      try {
        const res = await aufruf<unknown>({ methode: 'GET', pfad: `/v2/categories/${l1.id}` });
        const kinder = flacheListe(res.daten).map((k) => ({
          ...k,
          l1Id: k.l1Id ?? l1.id,
          l1Name: k.l1Name ?? l1.name,
        }));
        // Eine L1 ohne Kinder liefert sich selbst zurück — die gehört nicht
        // in die Liste der Ziele.
        zusammen.push(...kinder.filter((k) => k.id !== l1.id));
      } catch (err) {
        diagnose.push(`Kategorie ${l1.id} (${l1.name}) konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    kategorien = zusammen;
    diagnose.push(`Insgesamt ${kategorien.length} L2-Kategorien.`);
  }

  return { kategorien, diagnose };
}

// ---------------------------------------------------------------------------
// Zuordnung Plenty → Marktplaats
// ---------------------------------------------------------------------------

/**
 * Eine gepflegte Zuordnung.
 *
 * `stichwort` ist die normalisierte Plenty-Kategorie oder der Artikeltyp;
 * gespeichert wird normalisiert, damit „Bohrmaschinen" und „bohrmaschine"
 * nicht zwei Zeilen sind.
 */
export interface Zuordnung {
  stichwort: string;
  kategorieId: number;
  kategorieName: string | null;
}

/** Lädt die gepflegte Zuordnungstabelle. Ohne Datenbank: leer. */
export async function ladeZuordnung(): Promise<Map<string, Zuordnung>> {
  const supabase = createAdminClient();
  const map = new Map<string, Zuordnung>();
  if (!supabase) return map;
  try {
    const { data, error } = await supabase
      .from('marktplaats_zuordnung')
      .select('stichwort, kategorie_id, kategorie_name');
    if (error) return map;
    for (const zeile of data ?? []) {
      const stichwort = normalisiere(String((zeile as { stichwort: string }).stichwort ?? ''));
      const kategorieId = Number((zeile as { kategorie_id: number }).kategorie_id);
      if (!stichwort || !Number.isFinite(kategorieId)) continue;
      map.set(stichwort, {
        stichwort,
        kategorieId,
        kategorieName: (zeile as { kategorie_name: string | null }).kategorie_name ?? null,
      });
    }
  } catch {
    return map;
  }
  return map;
}

/**
 * Sucht die Kategorie zu einem Artikel.
 *
 * Geprüft wird in dieser Reihenfolge: die Plenty-Kategorie, dann der
 * Artikeltyp aus der Erkennung. Die Plenty-Kategorie zuerst, weil sie von
 * Menschen vergeben wurde; der Artikeltyp ist die Rückfallebene für alles,
 * was in Plenty in einer Sammelkategorie liegt.
 *
 * Kein Treffer heißt null — nicht „irgendeine". Der Artikel wird dann gezählt
 * und wartet, statt in einer fremden Rubrik zu landen.
 */
export function findeKategorie(
  zuordnung: Map<string, Zuordnung>,
  artikel: { plentyKategorie?: string | null; artikelTyp?: string | null },
): Zuordnung | null {
  for (const roh of [artikel.plentyKategorie, artikel.artikelTyp]) {
    const stichwort = normalisiere(roh ?? '');
    if (!stichwort) continue;
    const treffer = zuordnung.get(stichwort);
    if (treffer) return treffer;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ablage
// ---------------------------------------------------------------------------

/**
 * Legt den Kategoriebaum ab.
 *
 * Damit die Zuordnung durchsuchbar ist, ohne bei jedem Tastendruck die
 * Marktplaats-API zu fragen. Der Baum ändert sich selten — Marktplaats kündigt
 * größere Änderungen an.
 */
export async function speichereKategorien(kategorien: Kategorie[]): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase || !kategorien.length) return 0;
  let geschrieben = 0;
  for (let i = 0; i < kategorien.length; i += 200) {
    const block = kategorien.slice(i, i + 200).map((k) => ({
      kategorie_id: k.id,
      name: k.name,
      l1_id: k.l1Id,
      l1_name: k.l1Name,
      offen: k.offen,
      geladen_am: new Date().toISOString(),
    }));
    const { error } = await supabase.from('marktplaats_kategorien').upsert(block, { onConflict: 'kategorie_id' });
    if (!error) geschrieben += block.length;
  }
  return geschrieben;
}

/** Liest den abgelegten Kategoriebaum. */
export async function ladeKategorien(): Promise<Kategorie[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('marktplaats_kategorien')
      .select('kategorie_id, name, l1_id, l1_name, offen')
      .order('name');
    if (error) return [];
    return (data ?? []).map((z) => {
      const r = z as { kategorie_id: number; name: string; l1_id: number | null; l1_name: string | null; offen: boolean };
      return { id: r.kategorie_id, name: r.name, l1Id: r.l1_id, l1Name: r.l1_name, offen: r.offen };
    });
  } catch {
    return [];
  }
}

/** Trägt eine Zuordnung ein oder ändert sie. */
export async function speichereZuordnung(
  stichwort: string,
  kategorieId: number,
  opts: { kategorieName?: string | null; von?: string | null } = {},
): Promise<{ ok: boolean; fehler: string | null }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, fehler: 'Supabase ist nicht eingerichtet.' };
  const schluessel = normalisiere(stichwort);
  if (!schluessel) return { ok: false, fehler: 'Das Stichwort ist leer.' };
  if (!Number.isFinite(kategorieId) || kategorieId <= 0) {
    return { ok: false, fehler: 'Keine gültige Kategorie-ID.' };
  }
  const { error } = await supabase.from('marktplaats_zuordnung').upsert(
    {
      stichwort: schluessel,
      kategorie_id: kategorieId,
      kategorie_name: opts.kategorieName ?? null,
      geaendert_von: opts.von ?? null,
      geaendert_am: new Date().toISOString(),
    },
    { onConflict: 'stichwort' },
  );
  return error ? { ok: false, fehler: error.message } : { ok: true, fehler: null };
}

/** Löscht eine Zuordnung. */
export async function loescheZuordnung(stichwort: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { error } = await supabase.from('marktplaats_zuordnung').delete().eq('stichwort', normalisiere(stichwort));
  return !error;
}

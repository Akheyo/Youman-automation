/**
 * Was mit einem Artikel bei Marktplaats passieren soll.
 *
 * Die ganze Entscheidung steckt in einer reinen Funktion — ohne Netz, ohne
 * Datenbank. Das ist Absicht: Beim Abgleich über zehntausende Artikel ist
 * genau das der Teil, der stillen Schaden anrichtet. Eine Anzeige, die zu
 * Unrecht gelöscht wird, kostet die Platzierung und die Laufzeit; eine, die
 * doppelt angelegt wird, kostet zweimal Klickgebühr und sieht für Käufer aus
 * wie ein unseriöser Händler.
 *
 * DIE UNTERSCHEIDUNG, AUF DIE ES ANKOMMT: „Der Artikel ist gesperrt" und
 * „Beim Artikel fehlt etwas" sind nicht dasselbe.
 *
 *   - **Gesperrt** (Markenregel greift) heißt: Er darf nicht online sein.
 *     Steht er es doch, kommt er runter — sofort, nicht beim nächsten Mal.
 *   - **Unvollständig** (keine Kategorie, kein Preis) heißt: Er kann noch
 *     nicht hoch. Eine laufende Anzeige bleibt aber stehen. Ein Preis, der
 *     für eine Stunde fehlt, weil jemand in Plenty eine Preisliste
 *     umgestellt hat, darf nicht das ganze Sortiment abräumen.
 */

export type Massnahme = 'anlegen' | 'aendern' | 'loeschen' | 'nichts' | 'wartet';

export interface Lage {
  /** Bestand in Plenty. 0 heißt: verkauft oder ausgebucht. */
  bestand: number;
  /** Anzeige darf inhaltlich raus (Pflichtfelder vollständig). */
  bereit: boolean;
  /** Eine Markenregel sperrt den Artikel. Wiegt schwerer als alles andere. */
  gesperrt: boolean;
  /** Fingerabdruck der Anzeige, wie sie jetzt aussähe. Null, wenn nicht baubar. */
  fingerabdruck: string | null;
  /** Was bei Marktplaats steht — null, wenn dort noch nichts steht. */
  itemId: string | null;
  /** Fingerabdruck der zuletzt übertragenen Fassung. */
  bekannterFingerabdruck: string | null;
}

export interface Entscheidung {
  massnahme: Massnahme;
  /** Ein Satz fürs Protokoll. Steht in der Oberfläche an der Zeile. */
  grund: string;
}

/**
 * Entscheidet für einen Artikel.
 *
 * Die Reihenfolge der Prüfungen ist die Rangfolge: Sperre schlägt Bestand,
 * Bestand schlägt Inhalt. Wer sie umdreht, lässt einen gesperrten Artikel
 * online, solange sein Preis fehlt.
 */
export function entscheide(l: Lage): Entscheidung {
  // 1. Sperre — unabhängig von allem anderen.
  if (l.gesperrt) {
    return l.itemId
      ? { massnahme: 'loeschen', grund: 'Markenregel greift — die Anzeige kommt offline.' }
      : { massnahme: 'wartet', grund: 'Markenregel greift — wird nicht veröffentlicht.' };
  }

  // 2. Kein Bestand mehr.
  if (!(l.bestand > 0)) {
    return l.itemId
      ? { massnahme: 'loeschen', grund: 'Kein Bestand mehr — die Anzeige kommt offline.' }
      : { massnahme: 'nichts', grund: 'Kein Bestand, keine Anzeige.' };
  }

  // 3. Inhaltlich noch nicht so weit.
  if (!l.bereit || !l.fingerabdruck) {
    return l.itemId
      ? {
          massnahme: 'nichts',
          grund: 'Angaben unvollständig — die laufende Anzeige bleibt unverändert stehen.',
        }
      : { massnahme: 'wartet', grund: 'Angaben unvollständig — noch nicht veröffentlicht.' };
  }

  // 4. Noch nicht online.
  if (!l.itemId) {
    return { massnahme: 'anlegen', grund: 'Neu bei Marktplaats.' };
  }

  // 5. Online und unverändert.
  if (l.fingerabdruck === l.bekannterFingerabdruck) {
    return { massnahme: 'nichts', grund: 'Unverändert.' };
  }

  return { massnahme: 'aendern', grund: 'Inhalt hat sich geändert.' };
}

/** Zählwerk über einen Lauf. */
export interface Bilanz {
  angelegt: number;
  geaendert: number;
  geloescht: number;
  unveraendert: number;
  wartet: number;
  fehler: number;
}

export function leereBilanz(): Bilanz {
  return { angelegt: 0, geaendert: 0, geloescht: 0, unveraendert: 0, wartet: 0, fehler: 0 };
}

/** Bucht eine Maßnahme auf die Bilanz. */
export function zaehle(bilanz: Bilanz, massnahme: Massnahme): void {
  if (massnahme === 'anlegen') bilanz.angelegt += 1;
  else if (massnahme === 'aendern') bilanz.geaendert += 1;
  else if (massnahme === 'loeschen') bilanz.geloescht += 1;
  else if (massnahme === 'wartet') bilanz.wartet += 1;
  else bilanz.unveraendert += 1;
}

/** Maßnahmen, die die Gegenseite verändern — die einzigen, die ein Probelauf zurückhält. */
export function schreibt(massnahme: Massnahme): boolean {
  return massnahme === 'anlegen' || massnahme === 'aendern' || massnahme === 'loeschen';
}

/**
 * Die Speisekarte ist die Preisquelle — serverseitig, unveraenderlich.
 *
 * Preise kommen NIE aus dem Browser. Der Warenkorb schickt nur Artikel-IDs und
 * Mengen; gerechnet wird ausschliesslich hier. Sonst kann jeder mit den
 * Entwicklertools seine Pizza auf 1 Cent setzen.
 *
 * Alle Preise in Cent, damit nichts an Fliesskomma-Rundung verloren geht.
 *
 * STAND: Platzhalter-Sortiment. Die echte Karte liegt noch bei foodbooking und
 * muss vor dem Livegang hier eingepflegt werden — siehe README, Schritt 1.
 */

/** Mehrwertsteuersaetze. Speisen ausser Haus und Getraenke werden getrennt
 *  ausgewiesen; der konkrete Satz gehoert vor dem Livegang vom Steuerberater
 *  bestaetigt (Ausser-Haus vs. Verzehr vor Ort unterscheiden sich). */
export type MwstGruppe = 'speise' | 'getraenk';

export interface Zusatz {
  id: string;
  name: string;
  preis: number; // Aufpreis in Cent
}

export interface Artikel {
  id: string;
  name: string;
  beschreibung: string;
  preis: number; // Grundpreis in Cent
  mwst: MwstGruppe;
  kategorie: string;
  /** Pflichtangabe nach LMIV — ohne das darf die Karte nicht online. */
  allergene: string[];
  /** Kennzeichnungspflichtige Zusatzstoffe, z. B. "mit Farbstoff". */
  zusatzstoffe?: string[];
  /** Waehlbare Extras, etwa Belag oder Groesse. */
  extras?: Zusatz[];
  verfuegbar: boolean;
}

export const KATEGORIEN = ['Pizza', 'Pasta', 'Indische Gerichte', 'Beilagen', 'Getränke'] as const;

export const SPEISEKARTE: Artikel[] = [
  {
    id: 'pizza-margherita',
    name: 'Pizza Margherita',
    beschreibung: 'Tomaten, Mozzarella, Oregano',
    preis: 750,
    mwst: 'speise',
    kategorie: 'Pizza',
    allergene: ['Gluten', 'Milch'],
    extras: [
      { id: 'gross', name: 'Familiengröße (Ø 40 cm)', preis: 450 },
      { id: 'salami', name: 'Extra Salami', preis: 150 },
      { id: 'pilze', name: 'Extra Champignons', preis: 100 },
    ],
    verfuegbar: true,
  },
  {
    id: 'pizza-tonno',
    name: 'Pizza Tonno',
    beschreibung: 'Tomaten, Mozzarella, Thunfisch, Zwiebeln',
    preis: 920,
    mwst: 'speise',
    kategorie: 'Pizza',
    allergene: ['Gluten', 'Milch', 'Fisch'],
    extras: [{ id: 'gross', name: 'Familiengröße (Ø 40 cm)', preis: 450 }],
    verfuegbar: true,
  },
  {
    id: 'pasta-bolognese',
    name: 'Spaghetti Bolognese',
    beschreibung: 'Hausgemachte Hackfleischsoße, Parmesan',
    preis: 890,
    mwst: 'speise',
    kategorie: 'Pasta',
    allergene: ['Gluten', 'Milch', 'Ei'],
    verfuegbar: true,
  },
  {
    id: 'chicken-tikka-masala',
    name: 'Chicken Tikka Masala',
    beschreibung: 'Hähnchen in cremiger Tomaten-Curry-Soße, dazu Basmatireis',
    preis: 1290,
    mwst: 'speise',
    kategorie: 'Indische Gerichte',
    allergene: ['Milch', 'Senf'],
    extras: [{ id: 'scharf', name: 'Extra scharf', preis: 0 }],
    verfuegbar: true,
  },
  {
    id: 'naan-knoblauch',
    name: 'Knoblauch-Naan',
    beschreibung: 'Frisch gebackenes Fladenbrot mit Knoblauch und Butter',
    preis: 350,
    mwst: 'speise',
    kategorie: 'Beilagen',
    allergene: ['Gluten', 'Milch'],
    verfuegbar: true,
  },
  {
    id: 'cola-05',
    name: 'Coca-Cola 0,5 l',
    beschreibung: 'Einwegflasche, zzgl. Pfand',
    preis: 290,
    mwst: 'getraenk',
    kategorie: 'Getränke',
    allergene: [],
    zusatzstoffe: ['koffeinhaltig', 'mit Farbstoff'],
    verfuegbar: true,
  },
];

const NACH_ID = new Map(SPEISEKARTE.map((a) => [a.id, a]));

export function artikel(id: string): Artikel | undefined {
  return NACH_ID.get(id);
}

/** Aufpreis eines Extras — nur Extras, die am Artikel wirklich hinterlegt sind. */
export function extraPreis(a: Artikel, extraId: string): number | undefined {
  return a.extras?.find((e) => e.id === extraId)?.preis;
}

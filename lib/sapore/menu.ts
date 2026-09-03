/**
 * Sapore Grill — Stammdaten und Speisekarte.
 *
 * ACHTUNG: Die Speisekarte ist ein PLATZHALTER. Gerichte und Preise stammen
 * nicht vom Betrieb, sondern sind als Gerüst gesetzt, damit Layout, Warenkorb
 * und Bestellstrecke schon vollständig funktionieren. Sobald die echte Karte
 * vorliegt, nur noch die Einträge unten austauschen — die Oberfläche bleibt.
 * Beim Austauschen `MENU_IS_PLACEHOLDER` auf `false` setzen, dann verschwinden
 * die Platzhalter-Hinweise auf der Seite automatisch.
 */

export const MENU_IS_PLACEHOLDER = true;

export type Business = {
  name: string;
  tagline: string;
  claim: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  /** Fuer `tel:`-Links, im internationalen Format ohne Leerzeichen. */
  phoneHref: string;
  instagram: string;
  instagramUrl: string;
  openedOn: string;
  opensAt: number;
  closesAt: number;
};

export const BUSINESS: Business = {
  name: 'Sapore Grill',
  tagline: 'Döner · Pizza · Imbiss · Salate',
  claim: 'Frisch. Lecker. Qualität.',
  street: 'Johann-Walling-Straße 10',
  zip: '46325',
  city: 'Borken',
  phone: '02861 4303',
  phoneHref: '+4928614303',
  instagram: 'saporegrill_offiziell',
  instagramUrl: 'https://www.instagram.com/saporegrill_offiziell/',
  openedOn: '2026-09-01',
  /** Täglich gleich: 11:00 – 22:00 Uhr. */
  opensAt: 11,
  closesAt: 22,
};

export type DeliveryTerms = {
  minOrder: number;
  fee: number;
  freeFrom: number;
  etaDelivery: string;
  etaPickup: string;
  /** Postleitzahlen, in die geliefert wird. */
  zips: readonly string[];
};

/** Konditionen für die Lieferung — ebenfalls Platzhalter. */
export const DELIVERY: DeliveryTerms = {
  minOrder: 15,
  fee: 2.5,
  freeFrom: 30,
  etaDelivery: '30–45 Min.',
  etaPickup: '15–20 Min.',
  zips: ['46325'],
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  tags?: Array<'vegetarisch' | 'scharf' | 'beliebt' | 'neu'>;
  /**
   * Artikelnummer im Kassensystem. Wird gebraucht, sobald Bestellungen in die
   * Kasse laufen sollen: die Kasse kennt unsere IDs nicht, jede Position muss
   * auf einen dort angelegten Artikel zeigen. Solange leer, bleibt die Kasse
   * aussen vor und die Bestellung geht nur in die Kuechenansicht.
   */
  posId?: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  note: string;
  items: MenuItem[];
};

export const MENU: MenuCategory[] = [
  {
    id: 'doener',
    name: 'Döner & Kebap',
    note: '100 % Jungbullen-Fleisch. Kein Hack, kein Gepresstes.',
    items: [
      {
        id: 'steakdoener',
        name: 'Steakdöner vom Jungbullen',
        description: 'Saftige Steakstreifen, frischer Salat, Tomate, Zwiebel und Sauce nach Wahl.',
        price: 8.5,
        tags: ['beliebt'],
      },
      {
        id: 'gemuese-kebap',
        name: 'Gemüse Kebap',
        description: 'Gegrilltes Gemüse, Grillkäse, frischer Salat und Kräutersauce.',
        price: 7.5,
        tags: ['vegetarisch', 'neu'],
      },
      {
        id: 'duerum-steak',
        name: 'Dürüm Steakdöner',
        description: 'Steakstreifen im dünnen Fladen gerollt, mit Salat und Sauce.',
        price: 9.0,
      },
      {
        id: 'doener-box',
        name: 'Döner Box',
        description: 'Pommes mit Fleisch, Salat und Sauce — die handliche Portion.',
        price: 7.0,
      },
      {
        id: 'kebap-teller',
        name: 'Kebap Teller',
        description: 'Große Portion Fleisch mit Pommes oder Reis, Salat und Tzatziki.',
        price: 13.5,
      },
    ],
  },
  {
    id: 'pizza',
    name: 'Knusprige Pizza',
    note: 'Frisch belegt und im Steinofen gebacken.',
    items: [
      { id: 'pizza-margherita', name: 'Pizza Margherita', description: 'Tomatensauce, Mozzarella, Basilikum.', price: 8.0, tags: ['vegetarisch'] },
      { id: 'pizza-salami', name: 'Pizza Salami', description: 'Tomatensauce, Mozzarella, Salami.', price: 9.0 },
      { id: 'pizza-funghi', name: 'Pizza Funghi', description: 'Tomatensauce, Mozzarella, frische Champignons.', price: 9.0, tags: ['vegetarisch'] },
      { id: 'pizza-sapore', name: 'Pizza Sapore Spezial', description: 'Tomatensauce, Mozzarella, Kalbfleisch, Paprika, Zwiebeln.', price: 11.5, tags: ['beliebt'] },
      { id: 'pizza-vegetaria', name: 'Pizza Vegetaria', description: 'Tomatensauce, Mozzarella, Paprika, Zwiebeln, Mais, Champignons.', price: 9.5, tags: ['vegetarisch'] },
    ],
  },
  {
    id: 'imbiss',
    name: 'Deftiger Imbiss',
    note: 'Für den großen Hunger zwischendurch.',
    items: [
      {
        id: 'imbiss-teller',
        name: 'Imbiss-Teller',
        description: 'Currywurst, Pommes Frites, Mayonnaise und eine Portion Gyros mit Tzatziki.',
        price: 12.5,
        tags: ['beliebt'],
      },
      { id: 'currywurst-pommes', name: 'Currywurst mit Pommes', description: 'Currywurst mit hauseigener Sauce und knusprigen Pommes.', price: 7.5 },
      { id: 'pommes', name: 'Pommes Frites', description: 'Knusprig frittiert, mit Ketchup oder Mayonnaise.', price: 3.5, tags: ['vegetarisch'] },
      { id: 'nuggets', name: 'Chicken Nuggets', description: '6 Stück mit Pommes und Dip nach Wahl.', price: 7.0 },
    ],
  },
  {
    id: 'salate',
    name: 'Frische Salate',
    note: 'Täglich frisch geschnitten.',
    items: [
      { id: 'salat-feta', name: 'Gemischter Salat mit Feta', description: 'Blattsalat, Tomate, Gurke, Oliven, rote Zwiebeln und Feta.', price: 8.5, tags: ['vegetarisch'] },
      { id: 'salat-hirten', name: 'Hirtensalat', description: 'Tomate, Gurke, Paprika, Zwiebeln, Feta und Petersilie.', price: 8.0, tags: ['vegetarisch'] },
      { id: 'salat-haehnchen', name: 'Salat mit Hähnchen', description: 'Gemischter Salat mit gegrillten Hähnchenstreifen und Joghurt-Dressing.', price: 10.0 },
    ],
  },
  {
    id: 'getraenke',
    name: 'Getränke',
    note: 'Gekühlt, auch zum Mitnehmen.',
    items: [
      { id: 'softdrink', name: 'Softdrink 0,33 l', description: 'Cola, Fanta, Sprite oder Eistee.', price: 2.0 },
      { id: 'ayran', name: 'Ayran 0,25 l', description: 'Klassisch gesalzenes Joghurtgetränk.', price: 1.5 },
      { id: 'wasser', name: 'Wasser 0,5 l', description: 'Still oder mit Kohlensäure.', price: 1.5 },
    ],
  },
];

/** Preis als deutscher Euro-Betrag, z. B. `8,50 €`. */
export function formatPrice(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/** Flache Suche über alle Kategorien — für Warenkorb und Bestell-API. */
export function findItem(id: string): MenuItem | undefined {
  for (const category of MENU) {
    const hit = category.items.find((item) => item.id === id);
    if (hit) return hit;
  }
  return undefined;
}

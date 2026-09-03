/**
 * Warenkorb nachrechnen und pruefen.
 *
 * Der Browser schickt nur `{ artikelId, menge, extras[] }`. Alles andere —
 * Preise, Namen, Mehrwertsteuer, Liefergebuehr, Summe — entsteht hier aus der
 * Speisekarte. Damit ist Preismanipulation im Frontend wirkungslos.
 */

import { artikel, extraPreis, type Artikel } from './speisekarte';
import { gebietFuer, liefergebuehr, type Liefergebiet } from './liefergebiet';

export type Abholart = 'lieferung' | 'abholung';

export interface KorbPosten {
  artikelId: string;
  menge: number;
  extras?: string[];
}

export interface Adresse {
  strasse: string;
  plz: string;
  ort: string;
}

export interface BestellEingang {
  posten: KorbPosten[];
  abholart: Abholart;
  adresse?: Adresse;
  /** Trinkgeld in Cent, aus einer festen Auswahl im Frontend. */
  trinkgeld?: number;
  hinweis?: string;
}

export interface GerechneterPosten {
  artikelId: string;
  bezeichnung: string;
  menge: number;
  einzelpreis: number; // inkl. Extras, in Cent
  gesamt: number;
  mwst: Artikel['mwst'];
  allergene: string[];
}

export interface Rechnung {
  posten: GerechneterPosten[];
  warenwert: number;
  liefergebuehr: number;
  trinkgeld: number;
  summe: number;
  gebiet?: Liefergebiet;
}

export class KorbFehler extends Error {}

const MAX_MENGE = 20;
const MAX_POSTEN = 40;
const MAX_TRINKGELD = 2000; // 20 € — alles darueber ist ein Tippfehler oder ein Test

/**
 * Rechnet den Korb durch und wirft bei allem, was nicht stimmt, einen
 * `KorbFehler` mit einem Text, der so im Warenkorb angezeigt werden kann.
 */
export function rechne(eingang: BestellEingang): Rechnung {
  if (!Array.isArray(eingang.posten) || eingang.posten.length === 0) {
    throw new KorbFehler('Der Warenkorb ist leer.');
  }
  if (eingang.posten.length > MAX_POSTEN) {
    throw new KorbFehler('Zu viele verschiedene Positionen. Bitte ruf uns für große Bestellungen an.');
  }

  const posten: GerechneterPosten[] = eingang.posten.map((p) => {
    const a = artikel(p.artikelId);
    if (!a) throw new KorbFehler('Ein Artikel im Warenkorb existiert nicht mehr.');
    if (!a.verfuegbar) throw new KorbFehler(`${a.name} ist heute leider nicht verfügbar.`);

    const menge = Number(p.menge);
    if (!Number.isInteger(menge) || menge < 1 || menge > MAX_MENGE) {
      throw new KorbFehler(`Bitte wähle für ${a.name} eine Menge zwischen 1 und ${MAX_MENGE}.`);
    }

    const gewaehlt = p.extras ?? [];
    let aufpreis = 0;
    const extraNamen: string[] = [];
    for (const id of gewaehlt) {
      const preis = extraPreis(a, id);
      if (preis === undefined) throw new KorbFehler(`Die Option „${id}" gibt es bei ${a.name} nicht.`);
      aufpreis += preis;
      extraNamen.push(a.extras!.find((e) => e.id === id)!.name);
    }

    const einzelpreis = a.preis + aufpreis;
    return {
      artikelId: a.id,
      bezeichnung: extraNamen.length ? `${a.name} (${extraNamen.join(', ')})` : a.name,
      menge,
      einzelpreis,
      gesamt: einzelpreis * menge,
      mwst: a.mwst,
      allergene: a.allergene,
    };
  });

  const warenwert = posten.reduce((s, p) => s + p.gesamt, 0);

  let gebiet: Liefergebiet | undefined;
  let gebuehr = 0;
  if (eingang.abholart === 'lieferung') {
    const adr = eingang.adresse;
    if (!adr?.strasse?.trim() || !adr.plz?.trim() || !adr.ort?.trim()) {
      throw new KorbFehler('Bitte gib deine vollständige Lieferadresse an.');
    }
    gebiet = gebietFuer(adr.plz, adr.ort);
    if (!gebiet) {
      throw new KorbFehler('Dorthin liefern wir leider nicht. Abholung ist aber jederzeit möglich.');
    }
    if (warenwert < gebiet.mindestwert) {
      throw new KorbFehler(
        `Der Mindestbestellwert für ${gebiet.ort} liegt bei ${euro(gebiet.mindestwert)}. Es fehlen noch ${euro(gebiet.mindestwert - warenwert)}.`,
      );
    }
    gebuehr = liefergebuehr(gebiet, warenwert);
  }

  const trinkgeld = Math.max(0, Math.min(Math.round(Number(eingang.trinkgeld) || 0), MAX_TRINKGELD));

  return { posten, warenwert, liefergebuehr: gebuehr, trinkgeld, summe: warenwert + gebuehr + trinkgeld, gebiet };
}

export function euro(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

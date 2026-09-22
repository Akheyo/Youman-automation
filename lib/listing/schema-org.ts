/**
 * Strukturierte Daten (JSON-LD) für die Produktkarte.
 *
 * Die Produktkarten-Vorgabe verlangt BreadcrumbList, Product, ImageObject und
 * FAQPage. Der Nutzen ist konkret: Ohne `Product` mit `offers` zeigt Google
 * kein Rich Result, und ohne Preis und Verfügbarkeit im Markup ist das
 * `Product` unvollständig — dann fällt das Rich Result wieder weg.
 *
 * Zwei Regeln, die hier wichtiger sind als Vollständigkeit:
 *
 *   1. Nichts in das Markup schreiben, was nicht auch auf der Seite steht.
 *     Google wertet das als Verstoß, und abgestrafte Auszeichnung ist
 *     schlechter als gar keine.
 *   2. Kein Feld raten. Keine `gtin`, wenn wir nur eine Hausnummern-EAN
 *     vergeben haben; keine `brand`, wenn der Hersteller nicht genannt werden
 *     darf; keine `aggregateRating`, weil wir keine Bewertungen haben.
 */

import type { Erkennung } from '@/lib/erfassung/erkennung';
import type { Zustand } from '@/lib/preis/regelwerk';
import { LAPP_HERSTELLER, LAPP_LINIEN } from './markenregeln';
import type { FaqEintrag } from './texte';

/** Abbildung unserer Zustände auf schema.org/OfferItemCondition. */
export const ZUSTAND_SCHEMA: Record<Zustand, string> = {
  neu_versiegelt: 'https://schema.org/NewCondition',
  neu: 'https://schema.org/NewCondition',
  gebraucht: 'https://schema.org/UsedCondition',
  // Defekte Ware ist keine „gebrauchte" Ware im Sinne von schema.org —
  // dafür gibt es DamagedCondition, und die Unterscheidung ist gegenüber dem
  // Käufer die ehrlichere.
  defekt: 'https://schema.org/DamagedCondition',
};

export interface Brotkrume {
  name: string;
  url: string;
}

export interface Bild {
  url: string;
  /** Der Alt-Text, der auch im <img> steht. */
  alt: string;
  dateiname?: string | null;
}

export interface MarkupEingabe {
  erkennung: Erkennung;
  zustand: Zustand;
  /** Absolute URL der Produktseite. */
  url: string;
  /** Der H1 der Seite — muss wörtlich übereinstimmen. */
  name: string;
  /** Die Meta-Description der Seite — muss wörtlich übereinstimmen. */
  beschreibung: string;
  /** Brutto-Verkaufspreis im Webshop. Ohne Preis kein Angebot. */
  preis?: number | null;
  waehrung?: string;
  /** Wie viele Stück wir haben. 0 oder weniger heißt ausverkauft. */
  bestand?: number;
  bilder?: Bild[];
  brotkrumen?: Brotkrume[];
  faq?: FaqEintrag[];
  /** Bei LAPP: Hersteller und Produktlinie dürfen nirgends stehen — auch nicht im Markup. */
  generisch: boolean;
  /** Name des Verkäufers für `offers.seller`. */
  verkaeufer?: string;
  /**
   * Nur setzen, wenn es eine ECHTE, vom Hersteller vergebene GTIN ist.
   * Unsere intern erzeugten EANs (Präfix 20) gehören hier nicht hinein —
   * Google gleicht GTINs gegen echte Produktdaten ab.
   */
  gtin?: string | null;
}

export const STANDARD_WAEHRUNG = 'EUR';

function absolut(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * BreadcrumbList aus dem Kategorieweg.
 *
 * Nur mit absoluten URLs: Eine Brotkrume mit relativem Link wird von Google
 * als Fehler gemeldet, und eine fehlerhafte Auszeichnung nützt niemandem.
 */
export function baueBreadcrumbList(krumen: Brotkrume[]): object | null {
  const brauchbar = krumen.filter((k) => k.name?.trim() && absolut(k.url ?? ''));
  if (brauchbar.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: brauchbar.map((k, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: k.name.trim(),
      item: k.url,
    })),
  };
}

/** ImageObject je Bild — mit dem Alt-Text, der auch im Markup der Seite steht. */
export function baueImageObjects(bilder: Bild[]): object[] {
  return bilder
    .filter((b) => absolut(b.url ?? ''))
    .map((b) => ({
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      contentUrl: b.url,
      description: b.alt,
      ...(b.dateiname ? { name: b.dateiname } : {}),
    }));
}

/**
 * FAQPage aus den Fragen der Produktkarte.
 *
 * Nur Fragen, die auch sichtbar auf der Seite stehen. Eine FAQPage mit
 * unsichtbaren Fragen ist der klassische Weg, sich eine manuelle Maßnahme
 * einzufangen.
 */
export function baueFaqPage(faq: FaqEintrag[]): object | null {
  const brauchbar = (faq ?? []).filter((f) => f.frage?.trim() && f.antwort?.trim());
  if (brauchbar.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: brauchbar.map((f) => ({
      '@type': 'Question',
      name: f.frage.trim(),
      acceptedAnswer: { '@type': 'Answer', text: f.antwort.trim() },
    })),
  };
}

/**
 * Die Worte, die bei generischer Textung nirgends stehen duerfen.
 *
 * Das sind der erkannte Hersteller, das Modell und — weil „generisch" bei uns
 * praktisch immer LAPP bedeutet — der Markenname samt aller Produktlinien.
 */
export function verboteneWorte(erk: Erkennung): string[] {
  return [erk.hersteller, erk.modell, LAPP_HERSTELLER, ...LAPP_LINIEN]
    .filter((w): w is string => Boolean(w && w.trim().length >= 3))
    .map((w) => w.trim());
}

function enthaeltWort(text: string, wort: string): boolean {
  const muster = wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\d])${muster}(?![\\p{L}\\d])`, 'iu').test(text);
}

/**
 * Bricht ab, wenn bei generischer Textung trotzdem eine Marke im Markup landet.
 *
 * `brand` und `mpn` werden oben weggelassen — aber `name`, `description` und
 * `url` kommen von aussen. Genau dort rutscht der Herstellername durch, wenn
 * der Aufrufer den normalen Titel statt des generischen uebergibt. Die Vorgabe
 * lautet „darf nirgendwo stehen"; ein stiller Durchlauf waere ein
 * veroeffentlichter Verstoss, und den merkt niemand.
 */
export function pruefeGenerisch(e: MarkupEingabe): void {
  if (!e.generisch) return;
  const felder = [e.name, e.beschreibung, e.url, ...(e.bilder ?? []).flatMap((b) => [b.alt, b.dateiname ?? ''])];
  const gefunden = new Set<string>();
  for (const wort of verboteneWorte(e.erkennung)) {
    for (const feld of felder) {
      if (feld && enthaeltWort(feld, wort)) gefunden.add(wort);
    }
  }
  if (gefunden.size > 0) {
    throw new Error(
      `Markup abgelehnt: ${[...gefunden].join(', ')} darf bei diesem Artikel nirgends stehen, ` +
        'kommt aber in Titel, Beschreibung, URL oder Bildtext vor.',
    );
  }
}

/**
 * Product mit Angebot.
 *
 * Ohne Preis gibt es kein `offers` — und ohne `offers` kein Rich Result. Das
 * ist kein Mangel, sondern der richtige Zustand: Ein Artikel, für den die
 * Preisrecherche nichts gefunden hat, ist noch nicht verkaufsfertig.
 */
export function baueProduct(e: MarkupEingabe): object {
  pruefeGenerisch(e);
  const { erkennung: erk } = e;
  const marke = e.generisch ? null : erk.hersteller?.trim() || null;
  const modell = e.generisch ? null : erk.modell?.trim() || null;

  const eigenschaften = (erk.merkmale ?? [])
    .filter((m) => m.name?.trim() && m.wert?.trim())
    .map((m) => ({ '@type': 'PropertyValue', name: m.name.trim(), value: m.wert.trim() }));

  const bilder = (e.bilder ?? []).filter((b) => absolut(b.url ?? '')).map((b) => b.url);

  const bestand = e.bestand ?? 0;
  const preis = typeof e.preis === 'number' && e.preis > 0 ? e.preis : null;

  const angebot = preis
    ? {
        offers: {
          '@type': 'Offer',
          url: e.url,
          price: preis.toFixed(2),
          priceCurrency: e.waehrung ?? STANDARD_WAEHRUNG,
          itemCondition: ZUSTAND_SCHEMA[e.zustand],
          availability: bestand > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          ...(e.verkaeufer ? { seller: { '@type': 'Organization', name: e.verkaeufer } } : {}),
        },
      }
    : {};

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: e.name,
    description: e.beschreibung,
    ...(bilder.length > 0 ? { image: bilder } : {}),
    ...(marke ? { brand: { '@type': 'Brand', name: marke } } : {}),
    ...(modell ? { model: modell } : {}),
    ...(!e.generisch && erk.modellnummer ? { mpn: erk.modellnummer } : {}),
    // gtin NUR bei echter Hersteller-GTIN — unsere interne EAN gehört nicht hierher.
    ...(e.gtin ? { gtin13: e.gtin } : {}),
    ...(eigenschaften.length > 0 ? { additionalProperty: eigenschaften } : {}),
    ...angebot,
  };
}

/**
 * Alle Auszeichnungen der Seite in der Reihenfolge, in der sie eingebunden
 * werden. Was leer wäre, fehlt — ein leeres `FAQPage`-Gerüst ist ein Fehler,
 * kein neutraler Zustand.
 */
export function baueMarkup(e: MarkupEingabe): object[] {
  const teile: object[] = [];
  const krumen = baueBreadcrumbList(e.brotkrumen ?? []);
  if (krumen) teile.push(krumen);
  teile.push(baueProduct(e));
  teile.push(...baueImageObjects(e.bilder ?? []));
  const faq = baueFaqPage(e.faq ?? []);
  if (faq) teile.push(faq);
  return teile;
}

/**
 * Das fertige `<script>`-Tag für die Seite.
 *
 * `<` wird in `<` umgeschrieben: Stünde in einem Produktnamen ein
 * `</script>`, würde der Browser das Skript an dieser Stelle beenden — der
 * einzige Weg, sich über ein JSON-LD-Feld fremden Code auf die Seite zu holen.
 */
export function markupTag(e: MarkupEingabe): string {
  const json = JSON.stringify(baueMarkup(e)).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

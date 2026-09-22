/**
 * Das fertige Listing aus einem Guss.
 *
 * Führt zusammen, was in einzelnen Modulen steckt: Titel und Beschreibung
 * (`texte.ts`), Fließtext (`fliesstext.ts`), SEO-Felder (`seo.ts`),
 * strukturierte Daten (`schema-org.ts`) und die Markenregeln
 * (`markenregeln.ts`).
 *
 * Die Reihenfolge ist keine Willkür: Zuerst entsteht der Text, dann wird
 * geprüft, und erst wenn die Prüfung durchgeht, wird das Markup gebaut. Ein
 * JSON-LD-Block für ein Listing, das nicht veröffentlicht werden darf, wäre
 * nutzlos und im LAPP-Fall sogar der Verstoß selbst.
 */

import type { Erkennung } from '@/lib/erfassung/erkennung';
import { ZUSTAND_TEXT, type Zustand } from '@/lib/preis/regelwerk';
import { darfVeroeffentlichen, pruefeListing, type Befund } from './markenregeln';
import {
  baueMetaDescription,
  baueMetaKeywords,
  baueSeoTitle,
  baueUrlPfad,
  bildAltText,
  bildDateiname,
  suchbegriffeZeile,
  type SeoEingabe,
} from './seo';
import { baueMarkup, type Bild as MarkupBild, type Brotkrume } from './schema-org';
import { baueListing, baueProduktkarte, baueSortimentsverweis, type Fliesstext, type Listing } from './texte';

export interface ZusammenbauEingabe {
  erkennung: Erkennung;
  zustand: Zustand;
  /** Was der Mensch am Regal notiert hat. */
  notiz?: string | null;
  ean?: string | null;
  bearbeiter?: string | null;
  bestand?: number;
  /** Der Webshop-Preis fürs Markup. */
  preis?: number | null;
  fliesstext?: Fliesstext | null;
  /** Absolute Basis-Adresse des Shops, z. B. „https://shop.example.de". */
  shopBasis?: string | null;
  /** Absolute Adressen der Artikelfotos, in Anzeigereihenfolge. */
  bildUrls?: string[];
  /** Beschreibungen der Fotos aus der Erkennung, in derselben Reihenfolge. */
  bildRollen?: Array<string | null>;
  brotkrumen?: Brotkrume[];
  /** Der individuelle Teil des Abschlusstextes, falls jemand ihn vorgibt. */
  sortimentsverweis?: string | null;
  sortimentStichwort?: string | null;
}

export interface Listingpaket {
  listing: Listing;
  /** Die vollständige Produktkarte fürs Web. */
  produktkarte: string;
  seoTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  urlPfad: string;
  suchbegriffe: string;
  bilder: MarkupBild[];
  /** JSON-LD-Blöcke. Leer, wenn das Listing nicht veröffentlicht werden darf. */
  markup: object[];
  befunde: Befund[];
  darfVeroeffentlichtWerden: boolean;
}

/**
 * Setzt das ganze Listing zusammen.
 *
 * Wirft nicht, wenn die Markenprüfung anschlägt — das Ergebnis trägt die
 * Befunde und `darfVeroeffentlichtWerden: false`. Der Artikel soll trotzdem
 * in Plenty entstehen und dort mit dem Vermerk liegen; wegzuwerfen, was schon
 * geschrieben wurde, hilft niemandem, und im Büro ist der Befund die
 * nützlichere Information.
 */
export function baueListingpaket(e: ZusammenbauEingabe): Listingpaket {
  const { erkennung: erk } = e;

  const sortimentsverweis = e.sortimentsverweis ?? baueSortimentsverweis(erk.artikelTyp);

  const listing = baueListing({
    erkennung: erk,
    zustand: e.zustand,
    notiz: e.notiz,
    ean: e.ean,
    bearbeiter: e.bearbeiter,
    sortimentsverweis,
    sortimentStichwort: e.sortimentStichwort,
  });

  const seo: SeoEingabe = {
    artikelTyp: erk.artikelTyp,
    hersteller: erk.hersteller,
    modell: erk.modell,
    modellnummer: erk.modellnummer,
    kennwerte: erk.merkmale.filter((m) => m.wert).map((m) => m.wert),
    zustandsText: ZUSTAND_TEXT[e.zustand],
    generisch: listing.generisch,
  };

  const suchbegriffe = suchbegriffeZeile(listing.generisch ? null : erk.modellnummer);

  const produktkarte = baueProduktkarte({
    erkennung: erk,
    zustand: e.zustand,
    notiz: e.notiz,
    ean: e.ean,
    bearbeiter: e.bearbeiter,
    generisch: listing.generisch,
    sortimentsverweis,
    sortimentStichwort: e.sortimentStichwort,
    fliesstext: e.fliesstext ?? undefined,
    suchbegriffe,
  });

  const urlPfad = baueUrlPfad(
    listing.generisch ? null : erk.hersteller,
    listing.generisch ? null : erk.modell,
    erk.artikelTyp,
  );

  const bezeichnung = listing.generisch ? erk.artikelTyp : erk.titel;
  const bilder: MarkupBild[] = (e.bildUrls ?? []).map((url, i) => ({
    url,
    alt: bildAltText(bezeichnung, e.bildRollen?.[i] ?? null, i + 1),
    dateiname: bildDateiname(urlPfad, i + 1),
  }));

  const befunde = pruefeListing({
    titel1: listing.titel1,
    titel2: listing.titel2,
    titel3: listing.titel3,
    beschreibung: produktkarte,
    zustand: e.zustand,
  });
  const frei = darfVeroeffentlichen(befunde);

  const metaDescription = baueMetaDescription(seo);
  const seoTitle = baueSeoTitle(seo);

  // Das Markup wird nur gebaut, wenn das Listing freigegeben ist. Bei einem
  // gesperrten Listing würde `baueMarkup` bei generischer Textung ohnehin
  // abbrechen — und ein Markup für einen Text, der nicht online geht, hat
  // keinen Zweck.
  let markup: object[] = [];
  if (frei && e.shopBasis) {
    try {
      markup = baueMarkup({
        erkennung: erk,
        zustand: e.zustand,
        url: `${e.shopBasis.replace(/\/+$/, '')}/${urlPfad}`,
        name: listing.generisch ? erk.artikelTyp : erk.titel,
        beschreibung: metaDescription,
        preis: e.preis ?? null,
        bestand: e.bestand ?? 0,
        bilder,
        brotkrumen: e.brotkrumen,
        faq: e.fliesstext?.faq ?? [],
        generisch: listing.generisch,
      });
    } catch (fehler) {
      // Die Markup-Prüfung ist eine Sperre, kein Absturzgrund: Sie schlägt an,
      // wenn die Marke trotz Vorgabe doch im Titel steht. Dann gibt es eben
      // kein Markup, und der Befund steht daneben.
      befunde.push({
        schwere: 'sperre',
        regel: 'Strukturierte Daten',
        meldung: (fehler as Error).message,
      });
      markup = [];
    }
  }

  return {
    listing,
    produktkarte,
    seoTitle,
    metaDescription,
    metaKeywords: baueMetaKeywords(seo),
    urlPfad,
    suchbegriffe,
    bilder,
    markup,
    befunde,
    darfVeroeffentlichtWerden: darfVeroeffentlichen(befunde),
  };
}

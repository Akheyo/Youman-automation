/**
 * SEO-Felder nach der Produktkarten-Spezifikation.
 *
 * Die Formeln stammen aus dem internen Dokument „Produktkarte:
 * Schritt-für-Schritt-Anleitung" und sind dort auf das Zeichen genau
 * vorgegeben. Sie werden hier NACHGEBAUT, nicht neu erfunden — abweichen darf
 * man nur mit Grund.
 *
 * WAS BEI GEBRAUCHTER INDUSTRIEWARE ZUSÄTZLICH WIEGT: die Modell- und
 * Teilenummer in allen Schreibweisen. Wer ein Ersatzteil sucht, tippt
 * „06019H5200" — nicht „Akkuschrauber günstig".
 *
 * Und ehrlich: META-KEYWORDS wertet Google seit 2009 nicht mehr aus. Das Feld
 * wird gefüllt, weil PlentyONE es hat und die shop-interne Suche es je nach
 * Konfiguration nutzt. Zur Auffindbarkeit bei Google trägt es nichts bei.
 */

export const SHOPNAME = 'Komplett Konzept GmbH';

/** Vorgabe: bis zum Trennzeichen „|" höchstens 58 Zeichen. */
export const MAX_TITLE_VOR_TRENNER = 58;

/** Vorgabe: 135 bis 160 Zeichen. */
export const MIN_META_DESCRIPTION = 135;
export const MAX_META_DESCRIPTION = 160;

// ---------------------------------------------------------------------------
// Teile- und Modellnummern
// ---------------------------------------------------------------------------

/**
 * Schreibweisen einer Teile- oder Modellnummer.
 *
 * Es wird NICHTS erfunden — nur Trennzeichen entfernt oder vereinheitlicht.
 * Eine ausgedachte Variante träfe nichts und stünde nur im Weg.
 */
export function nummernVarianten(nummer: string | null | undefined): string[] {
  const roh = (nummer ?? '').trim();
  if (roh.length < 3) return [];

  const varianten = new Set<string>([roh]);
  const ohneTrenner = roh.replace(/[\s._/-]/g, '');
  if (ohneTrenner.length >= 3) varianten.add(ohneTrenner);
  if (/\s/.test(roh)) varianten.add(roh.replace(/\s+/g, '-'));
  if (/-/.test(roh)) varianten.add(roh.replace(/-+/g, ' '));
  varianten.add(roh.toUpperCase());

  return [...varianten].filter((v) => v.length >= 3);
}

/**
 * Die Zeile mit alternativen Schreibweisen — bei Ersatzteilen kein Beiwerk.
 * Leer, wenn es nichts Echtes zu ergänzen gibt; Stichwortstapeln schadet.
 */
export function suchbegriffeZeile(modellnummer: string | null | undefined): string {
  const varianten = nummernVarianten(modellnummer);
  if (varianten.length < 2) return '';
  return `Auch gesucht als: ${varianten.join(', ')}`;
}

// ---------------------------------------------------------------------------
// URL-Pfad
// ---------------------------------------------------------------------------

/** Macht aus Text einen URL-tauglichen Pfad. Umlaute werden ausgeschrieben. */
export function baueUrlPfad(...teile: Array<string | null | undefined>): string {
  return teile
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

// ---------------------------------------------------------------------------
// SEO-Title
// ---------------------------------------------------------------------------

export interface SeoEingabe {
  artikelTyp: string;
  hersteller?: string | null;
  modell?: string | null;
  modellnummer?: string | null;
  /** Ein bis zwei unterscheidende Angaben, z. B. „5G1,5 mm²". */
  kennwerte?: string[];
  zustandsText: string;
  /** Wofür man es braucht — ein Halbsatz, aus der Erkennung. */
  verwendung?: string | null;
  /** Bei LAPP dürfen Hersteller und Produktlinie nirgends vorkommen. */
  generisch: boolean;
}

function kuerzeAufWortgrenze(text: string, max: number): string {
  if (text.length <= max) return text;
  const geschnitten = text.slice(0, max);
  const luecke = geschnitten.lastIndexOf(' ');
  const ergebnis = luecke > max * 0.6 ? geschnitten.slice(0, luecke) : geschnitten;
  return ergebnis.replace(/[\s·,;–-]+$/, '');
}

/**
 * Baut den SEO-Title nach der Vorgabe:
 *
 *   [Produkt + kaufen] [Merkmale] | [Shopname]
 *
 * Das Haupt-Keyword steht ganz vorn, der Shop hinter dem Trennzeichen, und
 * der Teil davor bleibt unter 58 Zeichen — länger schneidet Google ab.
 *
 * Die Marke kommt nur mit, wenn sie trägt: Bei Gebrauchtware ist „Bosch" ein
 * Suchbegriff, ein unbekannter Hersteller dagegen verbraucht nur Platz, den
 * die Produktbezeichnung besser nutzt.
 */
export function baueSeoTitle(e: SeoEingabe, shopname = SHOPNAME): string {
  const marke = e.generisch ? null : e.hersteller?.trim() || null;
  const kern = [marke, e.generisch ? null : e.modell?.trim() || null, e.artikelTyp?.trim()]
    .filter(Boolean)
    .join(' ');

  let vorn = `${kern} kaufen`;
  for (const kennwert of e.kennwerte ?? []) {
    const erweitert = `${vorn} ${kennwert}`.trim();
    if (erweitert.length <= MAX_TITLE_VOR_TRENNER) vorn = erweitert;
  }

  vorn = kuerzeAufWortgrenze(vorn.replace(/\s+/g, ' ').trim(), MAX_TITLE_VOR_TRENNER);
  return `${vorn} | ${shopname}`;
}

// ---------------------------------------------------------------------------
// SEO-Description
// ---------------------------------------------------------------------------

/**
 * Baut die Meta-Description nach der Vorgabe:
 *
 *   [Keyword + Vorteil]. [Verwendungszweck] ★ [Vorteil 1] ★ [Vorteil 2]
 *   ✓ Kaufen bei [Shopname]!
 *
 * Die Sterne und Haken sind Absicht: Sie fallen in der Ergebnisliste auf und
 * heben den Treffer von den Nachbarn ab. Ziel sind 135–160 Zeichen — kürzer
 * verschenkt Fläche, länger wird abgeschnitten.
 *
 * Gekürzt wird von hinten nach Wichtigkeit: zuerst der zweite Vorteil, dann
 * der Verwendungszweck. Der Handlungsaufruf bleibt immer stehen.
 */
export function baueMetaDescription(e: SeoEingabe, shopname = SHOPNAME): string {
  const aufruf = `✓ Jetzt bei ${shopname} bestellen!`;
  const vorteil1 = '★ Sofort ab Lager';
  const vorteil2 = '★ Geprüfte Ware vom Fachbetrieb';
  const zweck = (e.verwendung ?? '').trim().replace(/[.\s]+$/, '');

  // Der Schwanz ist gesetzt: Ein Vorteil und der Handlungsaufruf bleiben immer
  // stehen. Gekürzt wird vorn — ein abgeschnittenes „Jetzt bei …" wäre genau
  // das Stück verloren, das wirken soll.
  const schwanz = `${vorteil1} ${aufruf}`;

  // Kopfvarianten, von vollständig bis knapp.
  const koepfe = [
    [e.generisch ? null : e.hersteller, e.generisch ? null : e.modell, e.artikelTyp],
    [e.generisch ? null : e.hersteller, e.artikelTyp],
    [e.artikelTyp],
  ]
    .map((teile) => teile.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
    .filter((k) => k.length > 0);

  const zusammen = (kopf: string, mitZweck: boolean, mitVorteil2: boolean) =>
    [`${kopf}, ${e.zustandsText}.`, mitZweck && zweck ? `${zweck}.` : '', mitVorteil2 ? vorteil2 : '', schwanz]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Alle sinnvollen Fassungen durchgehen und die LÄNGSTE nehmen, die noch
  // hineinpasst — das Fenster von 135 bis 160 Zeichen soll gefüllt werden,
  // nicht knapp unterschritten.
  let beste: string | null = null;
  for (const kopf of koepfe) {
    for (const [mitZweck, mitVorteil2] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as Array<[boolean, boolean]>) {
      const text = zusammen(kopf, mitZweck, mitVorteil2);
      if (text.length > MAX_META_DESCRIPTION) continue;
      if (!beste || text.length > beste.length) beste = text;
    }
  }
  if (beste) return beste;

  // Selbst der knappste Kopf ist zu lang: dann wird DER gekürzt, nie der Schluss.
  const kurz = koepfe[koepfe.length - 1];
  const platz = MAX_META_DESCRIPTION - schwanz.length - 1;
  const kopf = kuerzeAufWortgrenze(`${kurz}, ${e.zustandsText}.`, Math.max(platz, 10));
  return `${kopf} ${schwanz}`.replace(/\s+/g, ' ').trim();
}

/** Liegt die Description im empfohlenen Fenster? Für die Prüfung vor dem Hochladen. */
export function metaDescriptionInOrdnung(text: string): boolean {
  return text.length >= MIN_META_DESCRIPTION && text.length <= MAX_META_DESCRIPTION;
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

export const MAX_KEYWORDS = 20;

/**
 * Füllt das Keyword-Feld — bewusst knapp.
 *
 * Eine lange Liste bringt bei Google nichts und macht die shop-interne Suche
 * ungenauer, weil dann jeder Artikel auf jeden Begriff passt.
 */
export function baueMetaKeywords(e: SeoEingabe): string[] {
  const begriffe: string[] = [e.artikelTyp];

  if (!e.generisch) {
    if (e.hersteller) begriffe.push(e.hersteller, `${e.hersteller} ${e.artikelTyp}`);
    if (e.modell) begriffe.push(e.modell, [e.hersteller, e.modell].filter(Boolean).join(' '));
    begriffe.push(...nummernVarianten(e.modellnummer));
  }
  begriffe.push(...(e.kennwerte ?? []).slice(0, 4));
  begriffe.push(`${e.artikelTyp} gebraucht`, `${e.artikelTyp} kaufen`);

  const gesehen = new Set<string>();
  const raus: string[] = [];
  for (const roh of begriffe) {
    const begriff = (roh ?? '').replace(/\s+/g, ' ').trim();
    if (begriff.length < 2) continue;
    const schluessel = begriff.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(begriff);
    if (raus.length >= MAX_KEYWORDS) break;
  }
  return raus;
}

// ---------------------------------------------------------------------------
// Bilder
// ---------------------------------------------------------------------------

/**
 * Dateiname für ein Produktfoto nach Vorgabe: nur lateinische Kleinbuchstaben,
 * keine Leerzeichen, durchnummeriert.
 */
export function bildDateiname(basis: string, nummer: number, endung = 'jpg'): string {
  const pfad = baueUrlPfad(basis) || 'artikel';
  return `${pfad.slice(0, 60).replace(/-+$/, '')}-foto${nummer}.${endung}`;
}

/**
 * Alt-Text für ein Produktfoto.
 *
 * Vorgabe: Alt-Text, caption und description sollen sich ERGÄNZEN, nicht
 * wiederholen. Der Alt-Text benennt deshalb knapp, was zu sehen ist — die
 * ausführliche Beschreibung steht woanders.
 */
export function bildAltText(bezeichnung: string, rolle: string | null | undefined, nummer: number): string {
  const was: Record<string, string> = {
    uebersicht: 'Gesamtansicht',
    typenschild: 'Typenschild mit Herstellerangaben',
    schaden: 'Detailaufnahme des Zustands',
    detail: 'Detailansicht',
  };
  const zusatz = rolle && was[rolle] ? was[rolle] : `Ansicht ${nummer}`;
  return `${bezeichnung} – ${zusatz}`;
}

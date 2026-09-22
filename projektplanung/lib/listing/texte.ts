/**
 * Titel und Beschreibung für ein Listing.
 *
 * WARUM ZUSAMMENGESETZT UND NICHT GENERIERT: Das Wahrnehmen hat die
 * Bilderkennung schon erledigt — sie hat gesehen, was da liegt, welche Schäden
 * es hat und was dabei ist. Daraus einen Text zu BAUEN ist Formatierung, und
 * Formatierung gehört in Code: Sie ist testbar, immer gleich, und sie kann
 * nichts erfinden.
 *
 * Das ist keine Kleinigkeit. In diesen Texten stehen Pflichtsätze, deren
 * Fehlen laut Hersteller bis zu 10.000 € kostet, und Herstellernamen, die
 * nirgends auftauchen dürfen. Ein Textgenerator hält sich daran „meistens".
 *
 * Die Regeln stammen aus dem internen Ablaufdokument „Plenty_SOP_3".
 */

import type { Erkennung } from '@/lib/erfassung/erkennung';
import type { Zustand } from '@/lib/preis/regelwerk';
import { MAX_TITEL_1, MAX_TITEL_2_3, PFLICHTSATZ_KUGELLAGER, istLappArtikel, KUGELLAGER_HERSTELLER } from './markenregeln';

// ---------------------------------------------------------------------------
// Feste Textbausteine
// ---------------------------------------------------------------------------

/**
 * Hinweis, wenn das Titelbild nicht von uns stammt (SOP, wörtlich).
 * Steht im Original direkt über dem Abschlusstext.
 */
export const HINWEIS_HERSTELLERBILD =
  'Das Titelbild stammt vom jeweiligen Hersteller bzw. Rechteinhaber und dient ausschließlich der ' +
  'Veranschaulichung des angebotenen Artikels.';

/**
 * Querverweis auf das Sortiment (SOP, wörtlich). Das erste Stichwort wird
 * durch die Warengruppe des Artikels ersetzt.
 */
export function sortimentsHinweis(stichwort: string): string {
  return (
    `In unserem Onlineshop finden Sie nicht nur ${stichwort} sondern ein umfangreiches Sortiment rund um ` +
    'Fenster- und Türbeschläge – darunter Türdrücker, Beschläge, Türschließer, Rosetten, Montage- und ' +
    'Befestigungsteile sowie viele weitere Zubehör- und Ersatzteile. Ein Blick in unseren Shop lohnt sich!'
  );
}

/**
 * OFFEN: Der Standard-Abschlusstext steht im SOP nur als Verweis („make sure
 * this text always appears at the bottom"), nicht im Wortlaut. Solange er
 * fehlt, wird diese Marke gesetzt — sichtbar, damit es niemandem entgeht,
 * statt still eine leere Stelle zu lassen.
 */
export const ABSCHLUSSTEXT_FEHLT = '<!-- ABSCHLUSSTEXT FEHLT — bitte im Regelwerk hinterlegen -->';

const ZUSTANDSSATZ: Record<Zustand, string> = {
  neu_versiegelt: 'Neuware, originalverpackt und ungeöffnet.',
  neu: 'Neuware, unbenutzt. Verpackung geöffnet oder nicht mehr vorhanden.',
  gebraucht: 'Gebrauchter Artikel in funktionsfähigem Zustand.',
  defekt: 'Defekter Artikel. Wird ausdrücklich als defekt verkauft, zum Beispiel als Ersatzteilspender.',
};

// ---------------------------------------------------------------------------
// Titel
// ---------------------------------------------------------------------------

export interface Titelteil {
  text: string;
  /** Darf beim Kürzen nicht wegfallen. */
  pflicht?: boolean;
}

/**
 * Setzt einen Titel aus Bausteinen und kürzt ihn auf die erlaubte Länge.
 *
 * Gekürzt wird von HINTEN: Hersteller und Modell stehen vorn, weil danach
 * gesucht wird. Wegfallen darf das Beiwerk. Pflichtbausteine — „defekt" zum
 * Beispiel — bleiben immer stehen; passt es dann immer noch nicht, wird an
 * einer Wortgrenze abgeschnitten statt mitten im Wort.
 */
export function baueTitel(teile: Titelteil[], max: number): string {
  const vorhanden = teile.filter((t) => t.text && t.text.trim().length > 0);
  const laufend = [...vorhanden];

  const zusammen = (liste: Titelteil[]) =>
    liste
      .map((t) => t.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

  while (zusammen(laufend).length > max) {
    // Den letzten entbehrlichen Baustein entfernen.
    const index = [...laufend].reverse().findIndex((t) => !t.pflicht);
    if (index === -1) break;
    laufend.splice(laufend.length - 1 - index, 1);
  }

  let text = zusammen(laufend);
  if (text.length > max) {
    text = text.slice(0, max);
    const letzteLuecke = text.lastIndexOf(' ');
    if (letzteLuecke > max * 0.6) text = text.slice(0, letzteLuecke);
    text = text.trim();
  }
  return text;
}

export interface TitelEingabe {
  erkennung: Erkennung;
  zustand: Zustand;
  /** Bei LAPP dürfen Hersteller und Produktlinie nicht vorkommen. */
  generisch: boolean;
}

export interface Titel {
  titel1: string;
  titel2: string;
  titel3: string;
}

/**
 * Baut die drei Plenty-Namen.
 *
 * Titel 1 ist der kurze (max. 60 Zeichen), Titel 2 und 3 dürfen 80. Alle drei
 * beginnen mit dem, wonach gesucht wird, und enden mit dem, was beim Kürzen
 * entbehrlich ist.
 */
export function baueTitelSatz({ erkennung, zustand, generisch }: TitelEingabe): Titel {
  const merkmale = erkennung.merkmale ?? [];
  // Ein bis zwei technische Angaben, die wirklich unterscheiden.
  const kennwerte = merkmale.slice(0, 2).map((m) => `${m.wert}`.trim()).filter(Boolean);

  const basis: Titelteil[] = generisch
    ? [{ text: erkennung.artikelTyp, pflicht: true }]
    : [
        { text: erkennung.hersteller ?? '', pflicht: Boolean(erkennung.hersteller) },
        { text: erkennung.modell ?? '' },
        { text: erkennung.artikelTyp, pflicht: !erkennung.hersteller },
      ];

  // „defekt" MUSS im Titel stehen (SOP).
  const defektTeil: Titelteil[] = zustand === 'defekt' ? [{ text: 'defekt', pflicht: true }] : [];

  const kurz: Titelteil[] = [...basis, ...defektTeil];
  const mittel: Titelteil[] = [...basis, ...kennwerte.slice(0, 1).map((k) => ({ text: k })), ...defektTeil];
  const lang: Titelteil[] = [
    ...basis,
    ...kennwerte.map((k) => ({ text: k })),
    { text: erkennung.modellnummer ?? '' },
    ...defektTeil,
  ];

  return {
    titel1: baueTitel(kurz, MAX_TITEL_1),
    titel2: baueTitel(mittel, MAX_TITEL_2_3),
    titel3: baueTitel(lang, MAX_TITEL_2_3),
  };
}

// ---------------------------------------------------------------------------
// Beschreibung
// ---------------------------------------------------------------------------

export interface BeschreibungEingabe {
  erkennung: Erkennung;
  zustand: Zustand;
  /** Was der Mensch am Regal notiert hat — ohne den maschinellen Teil. */
  notiz?: string | null;
  ean?: string | null;
  /** Vor- und Nachname, damit nachvollziehbar ist, wer das Listing erstellt hat (SOP). */
  bearbeiter?: string | null;
  /** Das Titelbild stammt vom Hersteller, nicht von uns. */
  herstellerbild?: boolean;
  /** Warengruppe für den Sortiments-Querverweis, z. B. „Rosetten". Leer = kein Verweis. */
  sortimentStichwort?: string | null;
  generisch: boolean;
}

function entkomme(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function liste(eintraege: string[]): string {
  return `<ul>${eintraege.map((e) => `<li>${entkomme(e)}</li>`).join('')}</ul>`;
}

/**
 * Setzt die Artikelbeschreibung zusammen.
 *
 * Die Reihenfolge folgt dem, was ein Käufer wissen will, bevor er kauft:
 * Was ist es, in welchem Zustand, was fehlt, was ist dabei, welche Daten.
 * Rechtliches und Verweise stehen am Ende.
 */
export function baueBeschreibung(e: BeschreibungEingabe): string {
  const { erkennung, zustand } = e;
  const teile: string[] = [];

  const kopf = e.generisch ? erkennung.artikelTyp : erkennung.titel;
  teile.push(`<p><strong>${entkomme(kopf)}</strong></p>`);

  // --- Zustand ------------------------------------------------------------
  teile.push(`<p>${entkomme(ZUSTANDSSATZ[zustand])}</p>`);

  const maengel = [...(erkennung.schaeden ?? [])];
  const eigene = (e.notiz ?? '').trim();
  if (eigene) maengel.push(eigene);
  if (maengel.length > 0) {
    teile.push('<p><strong>Zustand im Einzelnen:</strong></p>');
    teile.push(liste(maengel));
  } else if (zustand !== 'defekt') {
    teile.push('<p>Keine nennenswerten Mängel festgestellt.</p>');
  }

  // --- Lieferumfang -------------------------------------------------------
  if ((erkennung.lieferumfang ?? []).length > 0) {
    teile.push('<p><strong>Lieferumfang:</strong></p>');
    teile.push(liste(erkennung.lieferumfang));
  }

  // --- Technische Daten ---------------------------------------------------
  const merkmale = (erkennung.merkmale ?? []).filter((m) => m.name && m.wert);
  if (merkmale.length > 0) {
    teile.push('<p><strong>Technische Daten:</strong></p>');
    teile.push(liste(merkmale.map((m) => `${m.name}: ${m.wert}`)));
  }

  // --- Kugellager-Pflichtsatz --------------------------------------------
  // Muss vor allem Weiteren stehen, damit er nicht am Ende übersehen wird.
  const istKugellager = KUGELLAGER_HERSTELLER.some(
    (h) => (erkennung.hersteller ?? '').toUpperCase().includes(h),
  );
  if (istKugellager && (zustand === 'neu' || zustand === 'neu_versiegelt')) {
    teile.push(`<p><strong>${entkomme(PFLICHTSATZ_KUGELLAGER)}</strong></p>`);
  }

  // --- EAN (SOP verlangt sie ausdrücklich in der Beschreibung) ------------
  if (e.ean) teile.push(`<p>EAN: ${entkomme(e.ean)}</p>`);

  // --- Verweise und Rechtliches ------------------------------------------
  if (e.sortimentStichwort) teile.push(`<p>${entkomme(sortimentsHinweis(e.sortimentStichwort))}</p>`);
  if (e.herstellerbild) teile.push(`<p>${entkomme(HINWEIS_HERSTELLERBILD)}</p>`);

  teile.push(ABSCHLUSSTEXT_FEHLT);

  if (e.bearbeiter) teile.push(`<p>Erstellt von: ${entkomme(e.bearbeiter)}</p>`);

  return teile.join('\n');
}

// ---------------------------------------------------------------------------
// Alles zusammen
// ---------------------------------------------------------------------------

export interface ListingEingabe extends Omit<BeschreibungEingabe, 'generisch'> {
  erkennung: Erkennung;
  zustand: Zustand;
}

export interface Listing extends Titel {
  beschreibung: string;
  /** Wahr, wenn Hersteller und Produktlinie weggelassen werden mussten (LAPP). */
  generisch: boolean;
}

/**
 * Erzeugt das vollständige Listing.
 *
 * Ob generisch getextet werden muss, wird hier entschieden und nicht dem
 * Zufall überlassen: Bei LAPP dürfen weder Herstellername noch Produktlinie
 * irgendwo auftauchen — also werden sie gar nicht erst eingebaut.
 */
export function baueListing(e: ListingEingabe): Listing {
  const texte = [e.erkennung.titel, e.erkennung.artikelTyp, e.erkennung.modell ?? ''];
  const generisch = istLappArtikel(e.erkennung.hersteller, texte);

  return {
    ...baueTitelSatz({ erkennung: e.erkennung, zustand: e.zustand, generisch }),
    beschreibung: baueBeschreibung({ ...e, generisch }),
    generisch,
  };
}

// ---------------------------------------------------------------------------
// Produktkarte: die vorgegebene Struktur
// ---------------------------------------------------------------------------

/**
 * Aufbau einer Produktkarte nach dem internen SEO-Dokument.
 *
 * Die Gliederung ist dort fest vorgegeben, und zwar mit Überschriftenebenen:
 *
 *   H1  Produktbezeichnung
 *       Teaser (2–3 Sätze, keine eigene Überschrift)
 *       Aufzählungspunkte (5, je ≤ 200 Zeichen, zusammen ≤ 1000)
 *   H2  Merkmale
 *   H3  Anwendung / Für wen geeignet
 *   H3  Vorteile
 *   H2  FAQ: Fragen und Antworten
 *   H2  Warum Sie bei uns kaufen sollten
 *
 * Die BESCHREIBENDEN Teile (Teaser, Anwendung, Vorteile, FAQ) sind Fließtext
 * und werden von der Texterzeugung gefüllt. Die STRUKTUR, die Längengrenzen
 * und die Pflichtblöcke stehen hier — das ist der Teil, der sich prüfen lässt.
 */

export const MAX_BULLET_ZEICHEN = 200;
export const MAX_BULLETS_GESAMT = 1000;
export const ANZAHL_BULLETS = 5;

export interface FaqEintrag {
  frage: string;
  antwort: string;
}

/** Die Fließtext-Teile. Leere Felder werden übersprungen, nicht erfunden. */
export interface Fliesstext {
  teaser?: string | null;
  bullets?: string[];
  anwendung?: string | null;
  vorteile?: string | null;
  faq?: FaqEintrag[];
}

/**
 * Kürzt die Aufzählungspunkte auf die vorgegebenen Grenzen.
 *
 * Fünf Punkte, je höchstens 200 Zeichen, zusammen höchstens 1000 — sonst
 * schneidet die Darstellung auf dem Handy sie ab, und abgeschnittene Vorteile
 * sind keine.
 */
export function begrenzeBullets(bullets: string[]): string[] {
  const raus: string[] = [];
  let gesamt = 0;
  for (const roh of bullets) {
    if (raus.length >= ANZAHL_BULLETS) break;
    const text = roh.replace(/\s+/g, ' ').trim().slice(0, MAX_BULLET_ZEICHEN);
    if (!text) continue;
    if (gesamt + text.length > MAX_BULLETS_GESAMT) break;
    raus.push(text);
    gesamt += text.length;
  }
  return raus;
}

export interface ProduktkarteEingabe extends BeschreibungEingabe {
  fliesstext?: Fliesstext;
  /** Zeile mit alternativen Schreibweisen der Teilenummer. */
  suchbegriffe?: string | null;
  /** Anker und Links zu Kategorien oder ähnlichen Artikeln (Vorgabe: 2–3). */
  querverweise?: Array<{ text: string; url: string }>;
}

/**
 * Setzt die vollständige Produktkarte zusammen.
 *
 * Was nicht geliefert wurde, wird weggelassen — kein Platzhaltertext, keine
 * leeren Überschriften. Eine Überschrift ohne Inhalt sieht für Google wie eine
 * unfertige Seite aus, und genau das wäre sie dann auch.
 */
export function baueProduktkarte(e: ProduktkarteEingabe): string {
  const { erkennung, zustand } = e;
  const t = e.fliesstext ?? {};
  const teile: string[] = [];

  const h1 = e.generisch ? erkennung.artikelTyp : erkennung.titel;
  teile.push(`<h1>${entkomme(h1)}</h1>`);

  if (t.teaser?.trim()) teile.push(`<p>${entkomme(t.teaser.trim())}</p>`);

  const bullets = begrenzeBullets(t.bullets ?? []);
  if (bullets.length > 0) teile.push(liste(bullets));

  // --- Zustand: steht bei Gebrauchtware vor allem Technischen, weil er die
  //     erste Frage jedes Käufers beantwortet.
  teile.push(`<h2>Zustand</h2>`);
  teile.push(`<p>${entkomme(ZUSTANDSSATZ[zustand])}</p>`);

  const maengel = [...(erkennung.schaeden ?? [])];
  const eigene = (e.notiz ?? '').trim();
  if (eigene) maengel.push(eigene);
  if (maengel.length > 0) teile.push(liste(maengel));
  else if (zustand !== 'defekt') teile.push('<p>Keine nennenswerten Mängel festgestellt.</p>');

  // --- Merkmale -----------------------------------------------------------
  const merkmale = (erkennung.merkmale ?? []).filter((m) => m.name && m.wert);
  if (merkmale.length > 0) {
    teile.push('<h2>Merkmale</h2>');
    teile.push(liste(merkmale.map((m) => `${m.name}: ${m.wert}`)));
  }

  if ((erkennung.lieferumfang ?? []).length > 0) {
    teile.push('<h3>Lieferumfang</h3>');
    teile.push(liste(erkennung.lieferumfang));
  }

  if (t.anwendung?.trim()) {
    teile.push(`<h3>Anwendung</h3>`);
    teile.push(`<p>${entkomme(t.anwendung.trim())}</p>`);
  }

  if (t.vorteile?.trim()) {
    teile.push(`<h3>Vorteile</h3>`);
    teile.push(`<p>${entkomme(t.vorteile.trim())}</p>`);
  }

  // --- FAQ ----------------------------------------------------------------
  // Vorgabe: kommerzielle Suchbegriffe hierhin auslagern, damit der Haupttext
  // sachlich bleibt.
  if ((t.faq ?? []).length > 0) {
    teile.push('<h2>FAQ: Fragen und Antworten</h2>');
    for (const eintrag of t.faq!) {
      teile.push(`<p><strong>${entkomme(eintrag.frage)}</strong><br>${entkomme(eintrag.antwort)}</p>`);
    }
  }

  // --- Pflichtsatz Kugellager --------------------------------------------
  const istKugellager = KUGELLAGER_HERSTELLER.some((h) => (erkennung.hersteller ?? '').toUpperCase().includes(h));
  if (istKugellager && (zustand === 'neu' || zustand === 'neu_versiegelt')) {
    teile.push(`<p><strong>${entkomme(PFLICHTSATZ_KUGELLAGER)}</strong></p>`);
  }

  // --- Warum bei uns ------------------------------------------------------
  teile.push('<h2>Warum Sie bei uns kaufen sollten</h2>');
  teile.push(
    '<p>Wir verwerten und prüfen Industrie- und Gebrauchtware seit Jahren im eigenen Haus. ' +
      'Jeder Artikel wird vor dem Verkauf gesichtet und fotografiert – Sie sehen genau das Stück, das Sie erhalten. ' +
      'Versand ab Lager, Rechnung mit ausgewiesener Umsatzsteuer, Ansprechpartner bei Rückfragen.</p>',
  );

  if ((e.querverweise ?? []).length > 0) {
    teile.push(
      liste([]).replace(
        '<ul></ul>',
        `<ul>${e.querverweise!
          .map((q) => `<li><a href="${entkomme(q.url)}">${entkomme(q.text)}</a></li>`)
          .join('')}</ul>`,
      ),
    );
  }

  // --- Technisches und Rechtliches ---------------------------------------
  if (e.ean) teile.push(`<p>EAN: ${entkomme(e.ean)}</p>`);
  if (e.suchbegriffe?.trim()) teile.push(`<p>${entkomme(e.suchbegriffe.trim())}</p>`);
  if (e.sortimentStichwort) teile.push(`<p>${entkomme(sortimentsHinweis(e.sortimentStichwort))}</p>`);
  if (e.herstellerbild) teile.push(`<p>${entkomme(HINWEIS_HERSTELLERBILD)}</p>`);

  teile.push(ABSCHLUSSTEXT_FEHLT);
  if (e.bearbeiter) teile.push(`<p>Erstellt von: ${entkomme(e.bearbeiter)}</p>`);

  return teile.join('\n');
}

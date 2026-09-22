/**
 * Der Durchlauf: vom Foto zum fertigen Artikel in Plenty.
 *
 * Die Kette ist Erkennung → Preis → Listing → Plenty. Sie läuft NICHT in
 * einem Aufruf, und das ist keine Bequemlichkeit: Jeder der vier Schritte
 * kostet für sich schon zehn bis fünfzig Sekunden (Bildauswertung,
 * Websuchen, Texterstellung, ein halbes Dutzend Plenty-Aufrufe), und
 * Serverless-Funktionen werden nach 60 Sekunden abgeschnitten. Ein Lauf, der
 * bei Sekunde 58 im dritten Schritt abbricht, hat alles bezahlt und nichts
 * gespeichert.
 *
 * Also: ein Schritt je Aufruf, Zwischenstand in der Datenbank, der nächste
 * Aufruf macht dort weiter. Das hat den Nebeneffekt, dass am Handy sichtbar
 * ist, wo der Artikel gerade steht.
 *
 * Hier steht nur, WAS als Nächstes dran ist — nicht, wie es gemacht wird.
 * Deshalb hängt diese Datei an nichts und lässt sich prüfen.
 */

export type SchrittName = 'erkennen' | 'preis' | 'listing' | 'plenty' | 'fertig';

export const SCHRITT_TEXT: Record<SchrittName, string> = {
  erkennen: 'Fotos auswerten',
  preis: 'Preis recherchieren',
  listing: 'Listing texten',
  plenty: 'In Plenty anlegen',
  fertig: 'Fertig',
};

/** Die Reihenfolge. Rückwärts geht nichts. */
export type Arbeitsschritt = Exclude<SchrittName, 'fertig'>;

export const SCHRITTE: Arbeitsschritt[] = ['erkennen', 'preis', 'listing', 'plenty'];

/** Der Zustand eines Artikels, so weit der Durchlauf ihn braucht. */
export interface Artikelstand {
  erkannt_am?: string | null;
  preis_am?: string | null;
  listing_am?: string | null;
  plenty_am?: string | null;
  erkennung_fehler?: string | null;
  preis_fehler?: string | null;
  listing_fehler?: string | null;
  plenty_fehler?: string | null;
}

const ZEITSTEMPEL: Record<Arbeitsschritt, keyof Artikelstand> = {
  erkennen: 'erkannt_am',
  preis: 'preis_am',
  listing: 'listing_am',
  plenty: 'plenty_am',
};

const FEHLER: Record<Arbeitsschritt, keyof Artikelstand> = {
  erkennen: 'erkennung_fehler',
  preis: 'preis_fehler',
  listing: 'listing_fehler',
  plenty: 'plenty_fehler',
};

/** Ist dieser Schritt erledigt? */
export function erledigt(stand: Artikelstand, schritt: Arbeitsschritt): boolean {
  return Boolean(stand[ZEITSTEMPEL[schritt]]);
}

/** Hängt dieser Schritt an einem Fehler? */
export function fehlgeschlagen(stand: Artikelstand, schritt: Arbeitsschritt): boolean {
  return Boolean(stand[FEHLER[schritt]]) && !erledigt(stand, schritt);
}

/**
 * Welcher Schritt ist als Nächstes dran?
 *
 * Der erste, der noch keinen Zeitstempel hat. Ein Fehler hält die Kette NICHT
 * auf Dauer an — er steht am Artikel, und der nächste Aufruf versucht es
 * wieder. Was hier nicht passiert: einen fehlgeschlagenen Schritt
 * überspringen. Ohne Preis kein Listing, und ein Listing ohne Preis wäre ein
 * Artikel, der für 0,00 € im Shop steht.
 */
export function naechsterSchritt(stand: Artikelstand): SchrittName {
  for (const schritt of SCHRITTE) {
    if (!erledigt(stand, schritt)) return schritt;
  }
  return 'fertig';
}

export interface Fortschritt {
  naechster: SchrittName;
  fertig: boolean;
  /** Wie viele der vier Schritte stehen. */
  erledigteSchritte: number;
  gesamtSchritte: number;
  /** Der Fehler des Schritts, der gerade dran ist — falls es einen gibt. */
  fehler: string | null;
  /** Ein Satz für die Anzeige am Handy. */
  text: string;
}

/**
 * Fasst den Stand zusammen.
 *
 * Der Text ist für die Anzeige gedacht und nennt beim Fehler auch den Grund:
 * „hängt" ohne Grund war schon einmal die Rückmeldung an jemanden, der vor
 * dem Regal stand und nicht weiterkam.
 */
export function fortschritt(stand: Artikelstand): Fortschritt {
  const naechster = naechsterSchritt(stand);
  const erledigteSchritte = SCHRITTE.filter((s) => erledigt(stand, s)).length;
  const fertig = naechster === 'fertig';
  const fehler = naechster === 'fertig' ? null : ((stand[FEHLER[naechster]] as string | null) ?? null);

  const text = fertig
    ? 'Artikel fertig und in Plenty angelegt.'
    : fehler
      ? `${SCHRITT_TEXT[naechster]} (${erledigteSchritte + 1}/${SCHRITTE.length}) — fehlgeschlagen: ${fehler}`
      : `${SCHRITT_TEXT[naechster]} (${erledigteSchritte + 1}/${SCHRITTE.length})`;

  return { naechster, fertig, erledigteSchritte, gesamtSchritte: SCHRITTE.length, fehler, text };
}

/**
 * Darf der Durchlauf von selbst weiterlaufen?
 *
 * Nach ein paar erfolglosen Anläufen nicht mehr. Ein Artikel, dessen
 * Preisrecherche dreimal nichts gefunden hat, findet beim vierten Mal auch
 * nichts — er kostet nur jedes Mal wieder Suchanfragen und Geld. Ab dann
 * muss jemand hinsehen.
 */
export const MAX_VERSUCHE = 3;

export function darfWeiterlaufen(versuche: number | null | undefined): boolean {
  return (versuche ?? 0) < MAX_VERSUCHE;
}

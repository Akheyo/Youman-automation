/**
 * Ein Schalter für die Auffindbarkeit in Suchmaschinen.
 *
 * Solange er auf `false` steht, trägt jede Seite ein `noindex` und es wird
 * keine Sitemap veröffentlicht. Die Seite bleibt dabei vollständig
 * erreichbar: wer die Adresse hat, sieht alles. Sie taucht nur in keiner
 * Suche auf.
 *
 * Ein Hinweis zur Technik, der oft falsch gemacht wird: Das Crawlen wird
 * NICHT über robots.txt gesperrt. Ein "Disallow: /" verbietet nur das
 * Abrufen der Seite, nicht die Aufnahme in den Index. Google nimmt eine
 * gesperrte Adresse trotzdem auf, wenn irgendwo ein Verweis darauf steht,
 * und zeigt sie dann ohne Inhalt an. Schlimmer noch: weil die Seite nicht
 * abgerufen werden darf, bekommt die Suchmaschine das `noindex` nie zu
 * sehen. Deshalb bleibt das Abrufen erlaubt und die Sperre steht dort, wo
 * sie wirkt: in jeder einzelnen Seite.
 *
 * Freigeben: hier `false` auf `true` setzen oder die Umgebungsvariable
 * INDEXIERUNG auf "an" setzen. Danach in der Google Search Console die
 * Sitemap einreichen, damit die Aufnahme nicht Wochen dauert.
 */

const ausUmgebung = process.env.INDEXIERUNG?.trim().toLowerCase();

/** Vorgabe im Code. Umgebungsvariable sticht sie. */
const FREIGEGEBEN = true;

export const indexierungErlaubt =
  ausUmgebung === 'an' ? true : ausUmgebung === 'aus' ? false : FREIGEGEBEN;

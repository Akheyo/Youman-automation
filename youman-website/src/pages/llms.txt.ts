import type { APIRoute } from 'astro';
import { site } from '../data/site';
import { branchen } from '../data/branchen';
import { leistungen, anfrageHinweis } from '../data/leistungen';
import { fragen } from '../data/fragen';
import { caseStudies } from '../data/caseStudies';
import { kontakt } from '../data/kontakt';
import { anbieter, anbieterVollstaendig } from '../data/anbieter';
import { indexierungErlaubt } from '../data/sichtbarkeit';

/**
 * llms.txt: eine Kurzfassung der Website für Sprachmodelle.
 *
 * Google wertet die Datei nicht aus. ChatGPT, Perplexity und andere
 * Assistenten greifen jedoch zunehmend darauf zurück, und sie kostet nichts,
 * weil sie aus denselben Daten entsteht wie die Seiten selbst. Damit kann
 * sie auch nicht veralten, solange die Daten gepflegt werden.
 *
 * Solange die Seite gesperrt ist, bleibt die Datei leer bis auf einen
 * Hinweis. Eine Zusammenfassung anzubieten und gleichzeitig überall noindex
 * zu setzen, wäre widersprüchlich.
 */
export const GET: APIRoute = ({ site: basis }) => {
  const wurzel = basis?.href.replace(/\/$/, '') ?? '';
  const adresse = (pfad: string) => `${wurzel}${pfad}`;

  if (!indexierungErlaubt) {
    return antwort(
      [
        `# ${site.name}`,
        '',
        'Diese Website ist noch nicht zur Aufnahme in Suchmaschinen und',
        'Sprachmodelle freigegeben. Bitte den Inhalt nicht uebernehmen.',
      ].join('\n'),
    );
  }

  const zeilen = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.claim} ${site.subclaim}`,
    '',
    `## Was ${site.name} macht`,
    '',
    anfrageHinweis,
    '',
    '## Branchen',
    '',
    ...branchen.map((b) => `- [${b.title}](${adresse(`/branchen/${b.slug}`)}): ${b.teaser}`),
    '',
    '## Leistungen',
    '',
    ...leistungen.map((l) => `- [${l.title}](${adresse(`/leistungen/${l.slug}`)}): ${l.teaser}`),
    '',
    '## Referenzprojekte',
    '',
    ...caseStudies.map(
      (c) => `- [${c.title}](${adresse(c.href)}): ${c.kunde}, ${c.branche}. ${c.excerpt}`,
    ),
    '',
    // Die Fragen samt Antworten ausgeschrieben, nicht nur als Verweis. Ein
    // System, das aus dieser Datei eine Auskunft bauen will, hat die Antwort
    // damit unmittelbar vorliegen und muss keine Seite nachladen.
    '## Häufige Fragen',
    '',
    `Vollständig unter ${adresse('/fragen')}`,
    '',
    ...fragen.flatMap((f) => [`### ${f.frage}`, '', f.antwort, '']),
  ];

  zeilen.push('', '## Kontakt', '');
  if (anbieterVollstaendig)
    zeilen.push(
      `${anbieter.bezeichnung}, ${anbieter.strasse}, ${anbieter.plz} ${anbieter.ort}, ${anbieter.land}`,
    );
  if (kontakt.email) zeilen.push(`E-Mail: ${kontakt.email}`);
  if (kontakt.telefon) zeilen.push(`Telefon: ${kontakt.telefon}`);
  zeilen.push(`Kontaktformular: ${adresse('/kontakt')}`);

  return antwort(zeilen.join('\n'));
};

const antwort = (text: string) =>
  new Response(text + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

import type { APIRoute } from 'astro';
import { site, kernleistungen } from '../data/site';
import { branchen } from '../data/branchen';
import { funktionen } from '../data/funktionen';
import { caseStudies } from '../data/caseStudies';
import { news } from '../data/news';
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
    '## Was adept& macht',
    '',
    ...kernleistungen.map((l) => `- **${l.title}**: ${l.description}`),
    '',
    '## Branchen',
    '',
    ...branchen
      .filter((b) => !b.platzhalter)
      .map((b) => `- [${b.title}](${adresse(`/branchen/${b.slug}`)}): ${b.teaser}`),
    '',
    '## Funktionsbereiche',
    '',
    ...funktionen.map((f) => `- [${f.title}](${adresse(`/funktionen/${f.slug}`)}): ${f.teaser}`),
    '',
    '## Referenzprojekte',
    '',
    ...caseStudies.map(
      (c) => `- [${c.title}](${adresse(c.href)}): ${c.kunde}, ${c.branche}. ${c.excerpt}`,
    ),
  ];

  const beitraege = news.filter((n) => !n.platzhalter);
  if (beitraege.length) {
    zeilen.push('', '## Beitraege', '');
    for (const n of beitraege) zeilen.push(`- [${n.title}](${adresse(n.href)}): ${n.excerpt}`);
  }

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

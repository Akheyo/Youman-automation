/**
 * Tagesbericht — einmal am Abend eine Mail: Was ist heute passiert, und wer
 * genau hat geöffnet oder geantwortet?
 *
 * Der Bericht ist für jemanden gebaut, der tagsüber nicht ins Cockpit schauen
 * kann und abends in zwei Minuten wissen will, ob etwas zu tun ist. Deshalb
 * stehen die Namen ganz oben, nicht die Summen: "Tim Kaldeuer (August Schmits)
 * hat geöffnet" ist eine Handlungsaufforderung, "12 Öffnungen" ist Statistik.
 *
 * Diese Datei baut nur den Text. Das Sammeln der Daten macht der Cron-Endpunkt.
 */

export interface BerichtKontakt {
  vorname: string | null;
  nachname: string | null;
  firma: string | null;
  email: string;
  /** Schritt der Sequenz, um den es ging. */
  schritt: number | null;
  /** Zeitpunkt des Ereignisses (ISO). */
  zeitpunkt: string;
  /** Bei Öffnungen: wie oft insgesamt. */
  anzahl?: number;
}

export interface BerichtKampagne {
  name: string;
  status: string;
  /** Vom Schutzschalter gesetzt — dann steht hier der Grund. */
  paused_reason?: string | null;
  gesendet: number;
  fehler: number;
  geoeffnet: BerichtKontakt[];
  geantwortet: BerichtKontakt[];
  abgemeldet: BerichtKontakt[];
  bounces: number;
  /** Offene Kontakte, die noch nicht durch sind. */
  offen: number;
}

export interface BerichtDaten {
  datum: Date;
  empfaenger: string;
  kampagnen: BerichtKampagne[];
  /** Tageskapazität des Postfach-Pools, falls eingerichtet. */
  kapazitaet?: { erlaubt: number; verbraucht: number } | null;
  /** Absolute Adresse des Cockpits für den Link am Ende. */
  cockpitUrl?: string | null;
}

export interface Bericht {
  subject: string;
  text: string;
  html: string;
}

function name(k: BerichtKontakt): string {
  const n = [k.vorname, k.nachname].filter(Boolean).join(' ').trim();
  return n || k.email;
}

function uhr(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  } catch {
    return '';
  }
}

function datumLang(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Eine Zeile je Kontakt — Name, Firma, wann, wie oft. */
function zeile(k: BerichtKontakt, art: 'geoeffnet' | 'geantwortet' | 'abgemeldet'): string {
  const firma = k.firma ? ` (${k.firma})` : '';
  const schritt = k.schritt ? `, Schritt ${k.schritt}` : '';
  const mal = art === 'geoeffnet' && k.anzahl && k.anzahl > 1 ? `, ${k.anzahl}×` : '';
  return `${name(k)}${firma} — ${uhr(k.zeitpunkt)} Uhr${schritt}${mal}`;
}

/** Gibt es überhaupt etwas zu berichten? Sonst schweigt der Bericht. */
export function hatInhalt(d: BerichtDaten): boolean {
  return d.kampagnen.some(
    (k) =>
      k.gesendet > 0 ||
      k.fehler > 0 ||
      k.bounces > 0 ||
      k.geoeffnet.length > 0 ||
      k.geantwortet.length > 0 ||
      k.abgemeldet.length > 0 ||
      Boolean(k.paused_reason),
  );
}

export function baueBericht(d: BerichtDaten): Bericht {
  const antworten = d.kampagnen.reduce((n, k) => n + k.geantwortet.length, 0);
  const oeffnungen = d.kampagnen.reduce((n, k) => n + k.geoeffnet.length, 0);
  const gesendet = d.kampagnen.reduce((n, k) => n + k.gesendet, 0);
  const gestoppt = d.kampagnen.filter((k) => k.paused_reason);

  // Betreff: das Wichtigste zuerst — Antworten schlagen Öffnungen schlagen Versand.
  const subject =
    gestoppt.length > 0
      ? `Paul: Kampagne angehalten — ${gestoppt[0]!.name}`
      : antworten > 0
        ? `Paul: ${antworten} ${antworten === 1 ? 'Antwort' : 'Antworten'} heute`
        : oeffnungen > 0
          ? `Paul: ${oeffnungen} ${oeffnungen === 1 ? 'Öffnung' : 'Öffnungen'}, ${gesendet} gesendet`
          : `Paul: ${gesendet} gesendet, noch keine Reaktion`;

  const t: string[] = [];
  const h: string[] = [];

  t.push(`Tagesbericht ${datumLang(d.datum)}`);
  h.push(`<h2 style="margin:0 0 4px;font-size:18px">Tagesbericht</h2><p style="margin:0 0 18px;color:#6b6b7b">${esc(datumLang(d.datum))}</p>`);

  for (const k of gestoppt) {
    t.push('', `⚠ ${k.name} wurde angehalten: ${k.paused_reason}`);
    h.push(
      `<div style="margin:0 0 16px;padding:12px 14px;border:1px solid #fecaca;background:#fef2f2;border-radius:10px;color:#991b1b"><strong>${esc(k.name)} wurde angehalten.</strong><br>${esc(k.paused_reason ?? '')}</div>`,
    );
  }

  for (const k of d.kampagnen) {
    t.push('', `— ${k.name} (${k.status}) —`);
    h.push(`<h3 style="margin:18px 0 6px;font-size:15px">${esc(k.name)} <span style="font-weight:400;color:#6b6b7b">· ${esc(k.status)}</span></h3>`);

    // Namen zuerst: das ist der Teil, auf den man reagiert.
    if (k.geantwortet.length) {
      t.push(`Geantwortet (${k.geantwortet.length}):`, ...k.geantwortet.map((c) => `  • ${zeile(c, 'geantwortet')}`));
      h.push(`<p style="margin:8px 0 2px"><strong>Geantwortet (${k.geantwortet.length})</strong></p><ul style="margin:0 0 8px;padding-left:18px">${k.geantwortet.map((c) => `<li>${esc(zeile(c, 'geantwortet'))}</li>`).join('')}</ul>`);
    }
    if (k.geoeffnet.length) {
      t.push(`Geöffnet (${k.geoeffnet.length}):`, ...k.geoeffnet.map((c) => `  • ${zeile(c, 'geoeffnet')}`));
      h.push(`<p style="margin:8px 0 2px"><strong>Geöffnet (${k.geoeffnet.length})</strong></p><ul style="margin:0 0 8px;padding-left:18px">${k.geoeffnet.map((c) => `<li>${esc(zeile(c, 'geoeffnet'))}</li>`).join('')}</ul>`);
    }
    if (k.abgemeldet.length) {
      t.push(`Abgemeldet (${k.abgemeldet.length}):`, ...k.abgemeldet.map((c) => `  • ${zeile(c, 'abgemeldet')}`));
      h.push(`<p style="margin:8px 0 2px"><strong>Abgemeldet (${k.abgemeldet.length})</strong></p><ul style="margin:0 0 8px;padding-left:18px">${k.abgemeldet.map((c) => `<li>${esc(zeile(c, 'abgemeldet'))}</li>`).join('')}</ul>`);
    }

    const summe = `Gesendet ${k.gesendet} · Fehler ${k.fehler} · Unzustellbar ${k.bounces} · Noch offen ${k.offen}`;
    t.push(summe);
    h.push(`<p style="margin:4px 0 0;color:#6b6b7b;font-size:13px">${esc(summe)}</p>`);
  }

  if (d.kapazitaet) {
    const kap = `Postfach heute: ${d.kapazitaet.verbraucht} von ${d.kapazitaet.erlaubt} erlaubten Mails`;
    t.push('', kap);
    h.push(`<p style="margin:18px 0 0;color:#6b6b7b;font-size:13px">${esc(kap)}</p>`);
  }

  if (d.cockpitUrl) {
    t.push('', `Cockpit: ${d.cockpitUrl}`);
    h.push(`<p style="margin:18px 0 0"><a href="${esc(d.cockpitUrl)}" style="color:#6d28d9">Zum Cockpit</a></p>`);
  }

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1b1733;max-width:640px">${h.join('')}</div>`;
  return { subject, text: t.join('\n'), html };
}

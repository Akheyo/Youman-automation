/** Alles auf Deutsch, alles so, wie man es im Alltag sagen würde. */

const datumZeit = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const nurZeit = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const nurTag = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const wochentag = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

export function zeitpunkt(wert: string | null | undefined): string {
  if (!wert) return 'nicht bekannt';
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return 'nicht bekannt';
  return datumZeit.format(d) + ' Uhr';
}

export function uhrzeit(wert: string | null | undefined): string {
  if (!wert) return 'nicht bekannt';
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return 'nicht bekannt';
  return nurZeit.format(d) + ' Uhr';
}

export function tagKurz(wert: string | null | undefined): string {
  if (!wert) return '';
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return '';
  return nurTag.format(d);
}

export function wochentagKurz(wert: string | null | undefined): string {
  if (!wert) return '';
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return '';
  return wochentag.format(d);
}

/** "vor 12 Minuten", "in 3 Stunden", "gerade eben". */
export function relativ(wert: string | null | undefined): string {
  if (!wert) return 'nicht bekannt';
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return 'nicht bekannt';

  const sekunden = Math.round((d.getTime() - Date.now()) / 1000);
  const vergangen = sekunden <= 0;
  const abstand = Math.abs(sekunden);

  if (abstand < 45) return vergangen ? 'gerade eben' : 'gleich';

  const stufen: Array<[number, string, string]> = [
    [60, 'Minute', 'Minuten'],
    [60, 'Stunde', 'Stunden'],
    [24, 'Tag', 'Tage'],
  ];

  let menge = abstand;
  let name = 'Sekunden';
  let einzahl = 'Sekunde';

  for (const [teiler, ein, mehr] of stufen) {
    if (menge < teiler) break;
    menge = Math.round(menge / teiler);
    einzahl = ein;
    name = mehr;
  }

  if (menge > 30 && name === 'Tage') {
    const monate = Math.round(menge / 30);
    return vergangen
      ? `vor ${monate} ${monate === 1 ? 'Monat' : 'Monaten'}`
      : `in ${monate} ${monate === 1 ? 'Monat' : 'Monaten'}`;
  }

  const wort = menge === 1 ? einzahl : name;
  const dativ = menge === 1 ? einzahl : name === 'Tage' ? 'Tagen' : name;
  return vergangen ? `vor ${menge} ${dativ}` : `in ${menge} ${wort}`;
}

function menge(wert: number, einzahl: string, mehrzahl: string): string {
  return `${wert} ${wert === 1 ? einzahl : mehrzahl}`;
}

/** "3 Minuten" statt "vor 3 Minuten", für Sätze wie "läuft seit ...". */
export function seit(wert: string | null | undefined): string {
  const r = relativ(wert);
  return r.startsWith('vor ') ? r.slice(4) : r;
}

export function dauer(sekunden: number | null | undefined): string {
  if (sekunden === null || sekunden === undefined || !Number.isFinite(sekunden)) return 'nicht bekannt';
  const s = Math.max(0, Math.round(sekunden));
  if (s < 60) return menge(s, 'Sekunde', 'Sekunden');

  const minuten = Math.floor(s / 60);
  const restSekunden = s % 60;
  if (minuten < 60) {
    return restSekunden === 0
      ? menge(minuten, 'Minute', 'Minuten')
      : `${menge(minuten, 'Minute', 'Minuten')} ${menge(restSekunden, 'Sekunde', 'Sekunden')}`;
  }

  const stunden = Math.floor(minuten / 60);
  const restMinuten = minuten % 60;
  return restMinuten === 0
    ? menge(stunden, 'Stunde', 'Stunden')
    : `${menge(stunden, 'Stunde', 'Stunden')} ${menge(restMinuten, 'Minute', 'Minuten')}`;
}

export function prozent(wert: number | null | undefined, stellen = 0): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return 'noch keine Angabe';
  return `${wert.toFixed(stellen).replace('.', ',')} %`;
}

export function anzahl(wert: number | null | undefined): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '0';
  return new Intl.NumberFormat('de-DE').format(wert);
}

/** Aus dem Cron-Ausdruck einen Satz machen, soweit das ohne Rätselraten geht. */
export function zeitplanText(cron: string | null | undefined): string {
  if (!cron) return 'kein fester Zeitplan';
  const teile = cron.trim().split(/\s+/);
  if (teile.length < 5) return cron;
  const [minute, stunde, tagImMonat, monat, tagInWoche] = teile;

  const jederTag = tagImMonat === '*' && monat === '*' && tagInWoche === '*';

  if (minute?.startsWith('*/') && stunde === '*' && jederTag) {
    return `alle ${minute.slice(2)} Minuten`;
  }
  if (minute === '*' && stunde === '*' && jederTag) return 'jede Minute';
  if (/^\d+$/.test(minute ?? '') && stunde === '*' && jederTag) return 'jede Stunde';
  if (stunde?.startsWith('*/') && jederTag) {
    return `alle ${stunde.slice(2)} Stunden`;
  }
  if (/^\d+$/.test(minute ?? '') && /^\d+$/.test(stunde ?? '') && jederTag) {
    return `täglich um ${stunde.padStart(2, '0')}:${minute.padStart(2, '0')} Uhr`;
  }
  return cron;
}

export function namenKurz(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) return name.trim();
  if (email && email.trim()) return email.trim();
  return 'nicht zugeordnet';
}

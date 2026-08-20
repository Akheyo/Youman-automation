import type { AutomationUebersicht, Durchlauf, Kennzahlen24h, OffenerFehler } from '../lib/types';
import { anzahl } from '../lib/format';

export type Gesamtzustand = 'blau' | 'gelb' | 'rot';

export interface Lage {
  zustand: Gesamtzustand;
  satz: string;
  erklaerung: string;
}

/**
 * Der Zustandsbalken sagt in einem deutschen Satz, ob alles in Ordnung ist.
 * Wer zum ersten Mal draufschaut, versteht die Lage, ohne eine Zahl zu lesen.
 */
export function lageBestimmen(
  automationen: AutomationUebersicht[],
  fehler: OffenerFehler[],
  laufende: Durchlauf[],
  kennzahlen: Kennzahlen24h | null,
): Lage {
  const kaputt = automationen.filter((eintrag) => eintrag.status === 'error');
  const schwer = fehler.filter((eintrag) => eintrag.severity === 'kritisch' || eintrag.severity === 'hoch');
  const leicht = fehler.filter((eintrag) => eintrag.severity === 'mittel' || eintrag.severity === 'niedrig');
  const angehalten = automationen.filter((eintrag) => eintrag.status === 'paused' || eintrag.status === 'stopped');
  const fehlerhafteLaeufe = kennzahlen?.fehlerhaft ?? 0;

  const laeuftGerade =
    laufende.length > 0
      ? `${anzahl(laufende.length)} ${laufende.length === 1 ? 'Durchlauf läuft' : 'Durchläufe laufen'} gerade.`
      : 'Gerade läuft nichts.';

  if (kaputt.length > 0 || schwer.length > 0) {
    const teile: string[] = [];
    if (kaputt.length === 1) teile.push(`${kaputt[0]?.name} steht mit einem Problem.`);
    if (kaputt.length > 1) teile.push(`${anzahl(kaputt.length)} Automationen stehen mit einem Problem.`);
    if (schwer.length === 1) teile.push('Ein schwerer Fehler ist offen.');
    if (schwer.length > 1) teile.push(`${anzahl(schwer.length)} schwere Fehler sind offen.`);
    return {
      zustand: 'rot',
      satz: 'Es gibt ein Problem',
      erklaerung: teile.join(' ') + ' Schau bitte in den Bereich Fehler.',
    };
  }

  if (leicht.length > 0 || fehlerhafteLaeufe > 0 || angehalten.length > 0) {
    const teile: string[] = [];
    if (leicht.length > 0) {
      teile.push(
        leicht.length === 1
          ? 'Ein Fehler wartet darauf, dass sich jemand kümmert.'
          : `${anzahl(leicht.length)} Fehler warten darauf, dass sich jemand kümmert.`,
      );
    }
    if (fehlerhafteLaeufe > 0) {
      teile.push(
        fehlerhafteLaeufe === 1
          ? 'In den letzten 24 Stunden ist ein Durchlauf fehlgeschlagen.'
          : `In den letzten 24 Stunden sind ${anzahl(fehlerhafteLaeufe)} Durchläufe fehlgeschlagen.`,
      );
    }
    if (angehalten.length > 0) {
      teile.push(
        angehalten.length === 1
          ? `${angehalten[0]?.name} ist angehalten.`
          : `${anzahl(angehalten.length)} Automationen sind angehalten.`,
      );
    }
    return {
      zustand: 'gelb',
      satz: 'Läuft, aber etwas wartet auf dich',
      erklaerung: teile.join(' '),
    };
  }

  return {
    zustand: 'blau',
    satz: 'Alles in Ordnung',
    erklaerung:
      automationen.length === 0
        ? 'Es ist noch keine Automation eingetragen.'
        : `Alle ${anzahl(automationen.length)} Automationen sind unauffällig. ${laeuftGerade}`,
  };
}

const zeichen: Record<Gesamtzustand, React.ReactNode> = {
  blau: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  gelb: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  rot: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
};

const flaeche: Record<Gesamtzustand, string> = {
  blau: 'var(--blau-weich)',
  gelb: 'var(--gelb-weich)',
  rot: 'var(--rot-weich)',
};

const farbe: Record<Gesamtzustand, string> = {
  blau: 'var(--blau)',
  gelb: 'var(--gelb)',
  rot: 'var(--rot)',
};

const klasse: Record<Gesamtzustand, string> = {
  blau: 'zustandBlau',
  gelb: 'zustandGelb',
  rot: 'zustandRot',
};

export default function Zustandsbalken({ lage }: { lage: Lage }) {
  return (
    <section className={`zustand ${klasse[lage.zustand]}`} aria-live="polite">
      <span
        className="zustandZeichen"
        style={{ background: flaeche[lage.zustand], color: farbe[lage.zustand] }}
        aria-hidden="true"
      >
        {zeichen[lage.zustand]}
      </span>
      <div className="zustandText">
        <h1>{lage.satz}</h1>
        <p>{lage.erklaerung}</p>
      </div>
    </section>
  );
}

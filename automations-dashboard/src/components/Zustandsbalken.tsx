import type { AutomationUebersicht, Durchlauf, Kennzahlen24h, OffenerFehler } from '../lib/types';
import { anzahl, prozent } from '../lib/format';
import Zeichen, { type ZeichenName } from './Icons';

export type Gesamtzustand = 'blau' | 'gelb' | 'rot';

export interface Fakt {
  wert: string;
  name: string;
}

export interface Lage {
  zustand: Gesamtzustand;
  satz: string;
  erklaerung: string;
  fakten: Fakt[];
  tat: { text: string; ziel: string } | null;
}

/**
 * Der Zustandsbalken sagt in einem deutschen Satz, ob alles in Ordnung ist.
 * Wer zum ersten Mal draufschaut, versteht die Lage, ohne eine Zahl zu lesen.
 * Die Zahlen darunter sind die Belege, nicht die Botschaft.
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
  const abgeschlossen = (kennzahlen?.erfolgreich ?? 0) + fehlerhafteLaeufe;
  const quote = abgeschlossen > 0 ? ((kennzahlen?.erfolgreich ?? 0) / abgeschlossen) * 100 : null;

  const fakten: Fakt[] = [
    { wert: anzahl(automationen.length), name: automationen.length === 1 ? 'Automation' : 'Automationen' },
    { wert: anzahl(laufende.length), name: 'läuft gerade' },
    { wert: anzahl(fehler.length), name: fehler.length === 1 ? 'offener Fehler' : 'offene Fehler' },
    { wert: quote === null ? 'keine' : prozent(quote), name: 'erfolgreich in 24 Stunden' },
  ];

  if (kaputt.length > 0 || schwer.length > 0) {
    const teile: string[] = [];
    if (kaputt.length === 1) teile.push(`${kaputt[0]?.name} steht mit einem Problem.`);
    if (kaputt.length > 1) teile.push(`${anzahl(kaputt.length)} Automationen stehen mit einem Problem.`);
    if (schwer.length === 1) teile.push('Ein schwerer Fehler ist offen.');
    if (schwer.length > 1) teile.push(`${anzahl(schwer.length)} schwere Fehler sind offen.`);
    return {
      zustand: 'rot',
      satz: 'Es gibt ein Problem',
      erklaerung: `${teile.join(' ')} Das solltest du dir jetzt ansehen.`,
      fakten,
      tat: { text: 'Fehler ansehen', ziel: '#/fehler' },
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
      fakten,
      tat:
        leicht.length > 0
          ? { text: 'Fehler ansehen', ziel: '#/fehler' }
          : { text: 'Automationen ansehen', ziel: '#/automationen' },
    };
  }

  return {
    zustand: 'blau',
    satz: 'Alles in Ordnung',
    erklaerung:
      automationen.length === 0
        ? 'Es ist noch keine Automation eingetragen. Sobald die erste in der Datenbank steht, siehst du sie hier.'
        : `Alle ${anzahl(automationen.length)} Automationen sind unauffällig, kein Fehler ist offen.`,
    fakten,
    tat: null,
  };
}

const zeichenName: Record<Gesamtzustand, ZeichenName> = {
  blau: 'haken',
  gelb: 'warnkreis',
  rot: 'warndreieck',
};

const klasse: Record<Gesamtzustand, string> = {
  blau: 'zustandBlau',
  gelb: 'zustandGelb',
  rot: 'zustandRot',
};

export default function Zustandsbalken({ lage, gehZu }: { lage: Lage; gehZu: (ziel: string) => void }) {
  return (
    <section className={`zustand ${klasse[lage.zustand]}`} aria-live="polite" aria-atomic="true">
      <span className="zustandZeichen">
        <Zeichen name={zeichenName[lage.zustand]} groesse={22} strich={2.2} />
      </span>
      <div className="zustandText">
        <h1>{lage.satz}</h1>
        <p>{lage.erklaerung}</p>

        <div className="zustandFakten">
          {lage.fakten.map((fakt) => (
            <span key={fakt.name} className="zustandFakt">
              <span className="zustandFaktWert">{fakt.wert}</span>
              {fakt.name}
            </span>
          ))}
        </div>

        {lage.tat && (
          <div className="zustandTat">
            <button type="button" className="knopf knopfHaupt" onClick={() => gehZu(lage.tat!.ziel)}>
              {lage.tat.text}
              <Zeichen name="pfeilRechts" groesse={15} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import styles from './zustand-bestand.module.css';
import type { Zustand } from '@/lib/preis/regelwerk';

/**
 * Die zwei Angaben, die kein Foto liefern kann.
 *
 * Der BESTAND ist auf keinem Bild zu sehen — zehn gleiche Kartons sehen aus
 * wie einer. Er entscheidet über den Gesamtwert und damit, ob sich ein
 * Listing überhaupt lohnt (ab 13 €).
 *
 * Den ZUSTAND schätzt die Bilderkennung zwar mit, aber wer das Teil in der
 * Hand hat, dreht es um, rüttelt daran und sieht, was auf keinem Foto ist.
 * Für den Preis zählt deshalb diese Angabe; die der Kamera bleibt als
 * Gegenprobe stehen.
 *
 * Vorausgewählt ist „gebraucht" — bei einer Verwertung ist das der Regelfall,
 * und eine Vorauswahl spart bei neun von zehn Artikeln einen Tipp. Ob jemand
 * ausdrücklich bestätigt hat, wird trotzdem festgehalten: Sonst ließe sich
 * später nicht unterscheiden, ob „gebraucht" eine Aussage war oder nur
 * niemand hingesehen hat.
 */

const ZUSTAENDE: Array<{ wert: Zustand; titel: string; hinweis: string }> = [
  { wert: 'neu_versiegelt', titel: 'Neu, versiegelt', hinweis: 'Originalverpackung ungeöffnet' },
  { wert: 'neu', titel: 'Neu, offen', hinweis: 'unbenutzt, Verpackung offen' },
  { wert: 'gebraucht', titel: 'Gebraucht', hinweis: 'funktionsfähig, Gebrauchsspuren' },
  { wert: 'defekt', titel: 'Defekt', hinweis: 'funktioniert nicht' },
];

export const MAX_BESTAND = 9999;

interface Props {
  zustand: Zustand;
  gravierendeSchaeden: boolean;
  bestand: number;
  gesperrt?: boolean;
  onZustand: (zustand: Zustand) => void;
  onGravierendeSchaeden: (wert: boolean) => void;
  onBestand: (bestand: number) => void;
}

export default function ZustandBestand({
  zustand,
  gravierendeSchaeden,
  bestand,
  gesperrt = false,
  onZustand,
  onGravierendeSchaeden,
  onBestand,
}: Props) {
  const setzeBestand = (wert: number) => {
    if (!Number.isFinite(wert)) return;
    onBestand(Math.min(Math.max(Math.round(wert), 1), MAX_BESTAND));
  };

  return (
    <div className={styles.block}>
      <section>
        <h2 className={styles.titel}>Zustand</h2>
        <div className={styles.raster}>
          {ZUSTAENDE.map((z) => (
            <button
              key={z.wert}
              type="button"
              className={`${styles.wahl} ${zustand === z.wert ? styles.wahlAktiv : ''}`}
              onClick={() => onZustand(z.wert)}
              disabled={gesperrt}
              aria-pressed={zustand === z.wert}
            >
              <span className={styles.wahlTitel}>{z.titel}</span>
              <span className={styles.wahlHinweis}>{z.hinweis}</span>
            </button>
          ))}
        </div>

        {/* Nur bei Gebrauchtware: Der Unterschied zwischen 65 % und 60 % vom
            Neupreis. Dreck und normale Spuren kosten nichts — deshalb steht
            hier ausdrücklich, was gemeint ist. */}
        {zustand === 'gebraucht' && (
          <button
            type="button"
            className={`${styles.schalter} ${gravierendeSchaeden ? styles.schalterAn : ''}`}
            onClick={() => onGravierendeSchaeden(!gravierendeSchaeden)}
            disabled={gesperrt}
            aria-pressed={gravierendeSchaeden}
          >
            <span className={styles.haken} aria-hidden>
              {gravierendeSchaeden ? '✓' : ''}
            </span>
            <span>
              <strong>Gravierende Schäden</strong>
              <br />
              <span className={styles.schalterHinweis}>
                Tiefe Kratzer, Risse, fehlende Teile. Schmutz und normale Gebrauchsspuren zählen nicht.
              </span>
            </span>
          </button>
        )}
      </section>

      <section>
        <h2 className={styles.titel}>Bestand</h2>
        <div className={styles.zaehler}>
          <button
            type="button"
            className={styles.stufe}
            onClick={() => setzeBestand(bestand - 1)}
            disabled={gesperrt || bestand <= 1}
            aria-label="Weniger"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            className={styles.menge}
            value={bestand}
            min={1}
            max={MAX_BESTAND}
            onChange={(e) => setzeBestand(Number(e.target.value))}
            disabled={gesperrt}
            aria-label="Stückzahl"
          />
          <button
            type="button"
            className={styles.stufe}
            onClick={() => setzeBestand(bestand + 1)}
            disabled={gesperrt || bestand >= MAX_BESTAND}
            aria-label="Mehr"
          >
            +
          </button>
        </div>
        <p className={styles.bestandHinweis}>
          Wie viele Stück von genau diesem Artikel. Entscheidet mit, ob sich ein Listing lohnt.
        </p>
      </section>
    </div>
  );
}

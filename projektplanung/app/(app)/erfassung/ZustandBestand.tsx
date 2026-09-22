'use client';

import { useEffect, useState } from 'react';

import styles from './zustand-bestand.module.css';
import { MAX_GEWICHT_KG, type Packklasse } from '@/lib/erfassung/logic';
import type { Zustand } from '@/lib/preis/regelwerk';

/**
 * Die drei Angaben, die kein Foto liefern kann.
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
 * Das GEWICHT entscheidet über den Versandsatz (7,90 / 9,90 / 14,90–29,90),
 * und der geht direkt vom Verkaufspreis ab: eBay sortiert nach Preis plus
 * Versand, also muss die Summe unterbieten. Geschätzt wird es deshalb nicht.
 * Bleibt das Feld leer, wird der Artikel trotzdem angelegt — das fehlende
 * Versandprofil steht dann als offener Punkt daran.
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

/** Ab hier entscheidet die Packklasse mit; darunter kostet alles dasselbe. */
export const PACKKLASSE_AB_KG = 10;

const PACKKLASSEN: Array<{ wert: Packklasse; titel: string; hinweis: string }> = [
  { wert: 'normal', titel: 'Normal', hinweis: 'passt in einen Karton' },
  { wert: 'sperrig', titel: 'Sperrig', hinweis: 'lang oder unhandlich' },
  { wert: 'schwierig', titel: 'Schwierig', hinweis: 'sperrig und aufwendig zu packen' },
];

/** „2,5" und „2.5" sind dasselbe Gewicht — in Deutschland wird mit Komma getippt. */
export function leseGewicht(text: string): number | null {
  const zahl = Number(text.replace(',', '.'));
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return Math.min(Math.round(zahl * 1000) / 1000, MAX_GEWICHT_KG);
}

function alsText(kg: number | null): string {
  return kg == null ? '' : String(kg).replace('.', ',');
}

interface Props {
  zustand: Zustand;
  gravierendeSchaeden: boolean;
  bestand: number;
  gewichtKg: number | null;
  packklasse: Packklasse;
  gesperrt?: boolean;
  onZustand: (zustand: Zustand) => void;
  onGravierendeSchaeden: (wert: boolean) => void;
  onBestand: (bestand: number) => void;
  onGewicht: (kg: number | null) => void;
  onPackklasse: (klasse: Packklasse) => void;
}

export default function ZustandBestand({
  zustand,
  gravierendeSchaeden,
  bestand,
  gewichtKg,
  packklasse,
  gesperrt = false,
  onZustand,
  onGravierendeSchaeden,
  onBestand,
  onGewicht,
  onPackklasse,
}: Props) {
  /**
   * Der getippte Text, getrennt vom Zahlenwert.
   *
   * Zwei Gründe, und beide haben wehgetan: Ein `type="number"` verwirft in
   * deutscher Eingabe das Komma — wer „2,5" tippt, bekommt ein leeres Feld
   * zurück und merkt es nicht, weil die Ziffern trotzdem dastehen. Und ohne
   * eigenen Text würde „2," bei jedem Tastendruck weggeräumt, sobald die
   * Zahl noch unvollständig ist.
   */
  const [eingabe, setEingabe] = useState(() => alsText(gewichtKg));

  // Von außen gesetzt — etwa beim Wechsel auf einen neuen Artikel.
  useEffect(() => {
    setEingabe((bisher) => (leseGewicht(bisher) === gewichtKg ? bisher : alsText(gewichtKg)));
  }, [gewichtKg]);

  const tippe = (roh: string) => {
    // Nur Ziffern und ein Trennzeichen zulassen; alles andere kommt ohnehin
    // nicht als Gewicht in Frage und erzeugt nur stille Fehleingaben.
    const sauber = roh.replace(/[^0-9.,]/g, '').slice(0, 8);
    setEingabe(sauber);
    onGewicht(leseGewicht(sauber));
  };

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

      <section>
        <h2 className={styles.titel}>Gewicht</h2>
        <div className={styles.gewichtZeile}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.gewicht}
            value={eingabe}
            placeholder="—"
            onChange={(e) => tippe(e.target.value)}
            disabled={gesperrt}
            aria-label="Gewicht in Kilogramm"
          />
          <span className={styles.einheit}>kg</span>
        </div>
        <p className={styles.bestandHinweis}>
          Ein Stück, verpackt. Ohne Gewicht kein Versandprofil — und damit kein belastbarer Preis.
          Lieber leer lassen als schätzen.
        </p>

        {/* Erst über 10 kg macht die Packklasse einen Unterschied: Darunter
            kostet jede Sendung denselben Satz. */}
        {gewichtKg != null && gewichtKg > PACKKLASSE_AB_KG && (
          <div className={styles.raster}>
            {PACKKLASSEN.map((k) => (
              <button
                key={k.wert}
                type="button"
                className={`${styles.wahl} ${packklasse === k.wert ? styles.wahlAktiv : ''}`}
                onClick={() => onPackklasse(k.wert)}
                disabled={gesperrt}
                aria-pressed={packklasse === k.wert}
              >
                <span className={styles.wahlTitel}>{k.titel}</span>
                <span className={styles.wahlHinweis}>{k.hinweis}</span>
              </button>
            ))}
          </div>
        )}

        {gewichtKg != null && gewichtKg > 30 && (
          <p className={styles.spedition}>
            Über 30 kg: kein Paketversand. Der Artikel geht nur per Spedition oder Abholung.
          </p>
        )}
      </section>
    </div>
  );
}

'use client';

/**
 * Oberfläche der Artikelsuche: „Der Artikel ist nicht da — wo könnte er sonst
 * liegen?"
 *
 * Aufbau von oben nach unten, in der Reihenfolge, in der man ihn braucht:
 *   1. Eingabe (Nummer scannen oder tippen)
 *   2. Lage — steht er überhaupt im Bestand, und wo? Der Satz entscheidet, ob
 *      man ins Regal geht oder in den Wareneingang.
 *   3. Kandidaten mit Begründung — wo zuerst nachsehen.
 *   4. Laufzettel — dieselben Plätze nach Laufweg, zum Ausdrucken.
 *   5. Vergleichsartikel mit Bild — die Sichtprüfung: Passt die Größe?
 */

import { useState } from 'react';
import styles from '../lagerplatz.module.css';
import eigen from './suche.module.css';

interface Beleg {
  signal: string;
  text: string;
  variationId: number | null;
  abstand: number | null;
}
interface Kandidat {
  code: string;
  klartext: string;
  punkte: number;
  belege: Beleg[];
  einwaende: string[];
  lagerortId: number | null;
  existiert: boolean;
}
interface Belegung {
  lagerortId: number;
  name: string;
  code: string | null;
  menge: number;
}
interface Artikelkarte {
  variationId: number;
  itemId: number | null;
  nummer: string | null;
  name: string | null;
  idAbstand: number;
  bildUrl: string | null;
  klasse: 'kleinteil' | 'mittel' | 'grossteil' | 'unbekannt';
  belegungen: Belegung[];
  textPlaetze: string[];
  angelegtAm: string | null;
}
interface Ergebnis {
  ok: boolean;
  konfiguriert: boolean;
  error: string | null;
  gesucht: Artikelkarte | null;
  lage: 'verbucht' | 'nur-standardplatz' | 'ohne-bestand' | 'unbekannt';
  lageText: string;
  kandidaten: Kandidat[];
  laufzettel: Kandidat[];
  nachbarn: Artikelkarte[];
  einlagerung: Artikelkarte[];
  dubletten: Artikelkarte[];
  aufDemSollplatz: Artikelkarte[];
  diagnose: string[];
  dauerMs: number;
}

/** Klartext je Signal — die Oberfläche soll nicht die internen Namen zeigen. */
const SIGNAL_TEXT: Record<string, string> = {
  'eigener-bestand': 'Bestand',
  'eigener-text': 'Artikeltext',
  historie: 'Warenbewegung',
  namensdublette: 'Gleicher Artikel',
  'id-nachbar': 'Nachbar-ID',
  einlagerung: 'Einlagerung',
  anlagedatum: 'Anlagetag',
  platztausch: 'Vertauscht?',
  'regal-nachbar': 'Regal nebenan',
};

const KLASSE_TEXT: Record<Artikelkarte['klasse'], string> = {
  kleinteil: 'Kleinteil',
  mittel: 'mittelgroß',
  grossteil: 'Großteil',
  unbekannt: 'Größe unbekannt',
};

const LAGE_STIL: Record<Ergebnis['lage'], string> = {
  verbucht: eigen.lageVerbucht,
  'nur-standardplatz': eigen.lageStandard,
  'ohne-bestand': eigen.lageOhne,
  unbekannt: eigen.lageUnbekannt,
};

/** Liest eine Antwort als JSON — bei einem Timeout schickt Vercel HTML. */
async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.status === 504 || /timed? ?out|FUNCTION_INVOCATION_TIMEOUT/i.test(text)
        ? 'Zeitüberschreitung — bitte mit kleinerer ID-Spanne erneut versuchen.'
        : `Unerwartete Antwort (HTTP ${res.status}).`,
    );
  }
}

/** Eine Artikelkachel mit Bild — für die Sichtprüfung der Größe. */
function Karte({ karte, gesucht = false }: { karte: Artikelkarte; gesucht?: boolean }) {
  const plaetze = karte.belegungen.filter((b) => b.lagerortId !== 0);
  return (
    <li className={`${eigen.karte} ${gesucht ? eigen.karteGesucht : ''}`}>
      {karte.bildUrl ? (
        // Bewusst <img> statt next/image: Die Plenty-URLs sind nicht als
        // erlaubte Domains konfiguriert, und die Bilder sind nur Beiwerk.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={eigen.bild} src={karte.bildUrl} alt={karte.name ?? ''} loading="lazy" />
      ) : (
        <div className={eigen.bildFehlt}>kein Bild</div>
      )}
      <div className={eigen.karteText}>
        <span className={eigen.karteNummer}>
          {karte.nummer ?? karte.variationId}
          {!gesucht && karte.idAbstand !== 0 && (
            <span className={styles.cellHint}> ({karte.idAbstand > 0 ? '+' : ''}{karte.idAbstand})</span>
          )}
        </span>
        <span className={eigen.karteName} title={karte.name ?? ''}>{karte.name ?? '—'}</span>
        <span className={styles.cellHint}>{KLASSE_TEXT[karte.klasse]}</span>
        {plaetze.length ? (
          plaetze.map((b) => (
            <span key={b.lagerortId} className={eigen.kartePlatz}>{b.name} · {b.menge} St.</span>
          ))
        ) : (
          <span className={styles.cellHint}>kein Lagerplatz</span>
        )}
      </div>
    </li>
  );
}

/** Ein Abschnitt mit Artikelkacheln — wird nur gezeigt, wenn er etwas enthält. */
function Kartenblock({ titel, hinweis, karten }: { titel: string; hinweis: string; karten: Artikelkarte[] }) {
  if (!karten.length) return null;
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{titel}</h2>
        <span className={styles.cellHint}>{karten.length}</span>
      </div>
      <p className={styles.hint} style={{ marginTop: 0, marginBottom: '1rem' }}>{hinweis}</p>
      <ul className={eigen.karten}>
        {karten.map((k) => <Karte key={k.variationId} karte={k} />)}
      </ul>
    </section>
  );
}

export default function Suche({ plentyReady }: { plentyReady: boolean }) {
  const [eingabe, setEingabe] = useState('');
  const [idSpanne, setIdSpanne] = useState(5);
  const [zeitfenster, setZeitfenster] = useState(45);
  const [mitNamenssuche, setMitNamenssuche] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  async function suchen(e: React.FormEvent) {
    e.preventDefault();
    if (!eingabe.trim() || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    setErgebnis(null);
    try {
      const res = await fetch('/api/lagerplatz/suche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eingabe: eingabe.trim(),
          idSpanne,
          zeitfensterMin: zeitfenster,
          mitNamenssuche,
        }),
      });
      const daten = (await alsJson(res)) as unknown as Ergebnis;
      if (!daten.ok) throw new Error(daten.error ?? 'Die Suche ist fehlgeschlagen.');
      setErgebnis(daten);
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaeuft(false);
    }
  }

  // Jeder Beleg nennt die Variante, auf die er sich stützt. Damit lässt sich in
  // der Kandidatenliste direkt das Bild dazu zeigen — ohne einen weiteren
  // Abruf, denn die Karten sind ohnehin schon geladen.
  const nachVariante = new Map<number, Artikelkarte>();
  for (const k of [
    ...(ergebnis?.gesucht ? [ergebnis.gesucht] : []),
    ...(ergebnis?.nachbarn ?? []),
    ...(ergebnis?.dubletten ?? []),
    ...(ergebnis?.einlagerung ?? []),
    ...(ergebnis?.aufDemSollplatz ?? []),
  ]) {
    if (!nachVariante.has(k.variationId)) nachVariante.set(k.variationId, k);
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Lager</span>
        <h1 className={styles.title}>Artikel nicht gefunden</h1>
        <p className={styles.subtitle}>
          Artikelnummer eingeben — die Suche sammelt aus PlentyONE alles, was auf einen anderen
          Lagerplatz hindeutet: den Artikeltext, seine Warenbewegungen, gleichnamige Artikel, die
          Nachbar-IDs, die Einlagerung im selben Zeitfenster und die Plätze direkt daneben.
          Sie bucht nichts um.
        </p>
      </header>

      {!plentyReady && (
        <div className={`${styles.notice} ${styles.noticeWarn}`}>
          PlentyONE ist nicht eingerichtet — ohne Zugangsdaten kann nicht gesucht werden.
        </div>
      )}
      {fehler && <div className={`${styles.notice} ${styles.noticeErr}`}>{fehler}</div>}

      <form className={styles.card} onSubmit={suchen}>
        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="eingabe">Artikelnummer, Varianten-ID oder EAN</label>
            <input
              id="eingabe"
              className={eigen.eingabe}
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder="z. B. 44231 oder ART-44231"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="spanne">IDs drüber/drunter</label>
            <select
              id="spanne"
              className={styles.select}
              value={idSpanne}
              onChange={(e) => setIdSpanne(Number(e.target.value))}
            >
              {[3, 5, 10, 15].map((n) => <option key={n} value={n}>±{n}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fenster">Zeitfenster Einlagerung</label>
            <select
              id="fenster"
              className={styles.select}
              value={zeitfenster}
              onChange={(e) => setZeitfenster(Number(e.target.value))}
            >
              {[15, 45, 120, 480].map((n) => (
                <option key={n} value={n}>±{n < 60 ? `${n} min` : `${n / 60} h`}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={mitNamenssuche}
                onChange={(e) => setMitNamenssuche(e.target.checked)}
              />
              Gleichnamige Artikel suchen
            </label>
            <span className={styles.checkHint}>
              Bei Gebrauchtware oft der beste Hinweis: Das zweite Exemplar steht meist beim ersten.
            </span>
          </div>
          <button className={styles.primary} disabled={laeuft || !eingabe.trim() || !plentyReady}>
            {laeuft ? 'Sucht …' : 'Suchen'}
          </button>
        </div>
      </form>

      {ergebnis?.gesucht && (
        <>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>
                {ergebnis.gesucht.nummer ?? ergebnis.gesucht.variationId} — {ergebnis.gesucht.name ?? 'ohne Namen'}
              </h2>
              <span className={styles.cellHint}>{(ergebnis.dauerMs / 1000).toFixed(1)} s</span>
            </div>
            <div className={`${eigen.lage} ${LAGE_STIL[ergebnis.lage]}`}>
              <span>{ergebnis.lageText}</span>
            </div>
            <ul className={eigen.karten}>
              <Karte karte={ergebnis.gesucht} gesucht />
            </ul>
            {ergebnis.gesucht.klasse !== 'unbekannt' && (
              <p className={styles.hint}>
                Eingestuft als <strong>{KLASSE_TEXT[ergebnis.gesucht.klasse]}</strong> — Plätze, die dazu
                nicht passen, sind unten abgewertet und mit dem Grund versehen.
              </p>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Wo zuerst nachsehen</h2>
              <span className={styles.cellHint}>{ergebnis.kandidaten.length} Plätze</span>
            </div>
            {ergebnis.kandidaten.length ? (
              <ol className={eigen.kandidaten}>
                {ergebnis.kandidaten.map((k) => (
                  <li
                    key={k.code}
                    className={`${eigen.kandidat} ${k.einwaende.length ? eigen.kandidatSchwach : ''}`}
                  >
                    <div className={eigen.punkte}>
                      <span className={eigen.punkteZahl}>{Math.round(k.punkte)}</span>
                      <span className={eigen.punkteLabel}>Pkt</span>
                    </div>
                    <div>
                      <div className={eigen.kandidatCode}>{k.code}</div>
                      <p className={eigen.kandidatKlartext}>{k.klartext}</p>
                      <ul className={eigen.belege}>
                        {k.belege.map((b, i) => {
                          const karte = b.variationId !== null ? nachVariante.get(b.variationId) : undefined;
                          return (
                            <li key={i} className={eigen.beleg}>
                              {karte?.bildUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  className={eigen.belegBild}
                                  src={karte.bildUrl}
                                  alt={karte.name ?? ''}
                                  title={`${karte.nummer ?? karte.variationId} — ${karte.name ?? ''}`}
                                  loading="lazy"
                                />
                              ) : (
                                <span className={eigen.belegBildLeer} aria-hidden="true" />
                              )}
                              <span className={`${styles.badge} ${styles.badgeMuted}`}>
                                {SIGNAL_TEXT[b.signal] ?? b.signal}
                              </span>
                              <span className={eigen.belegText}>
                                {b.text}
                                {karte?.klasse && karte.klasse !== 'unbekannt' && (
                                  <span className={styles.cellHint}> · {KLASSE_TEXT[karte.klasse]}</span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {k.einwaende.map((e) => (
                        <p key={e} className={eigen.einwand}>⚠ {e}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>
                Kein Hinweis auf einen anderen Platz. Bleiben die Warenbewegungen in Plenty und die
                Suche über den Artikeltitel im Shop.
              </p>
            )}
          </section>

          {ergebnis.laufzettel.length > 1 && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Laufzettel</h2>
                <button type="button" className={styles.secondary} onClick={() => window.print()}>
                  Drucken
                </button>
              </div>
              <p className={styles.hint} style={{ marginTop: 0, marginBottom: '1rem' }}>
                Dieselben Plätze, aber nach Laufweg sortiert — einmal durch die Halle statt hin und her.
              </p>
              <ol className={eigen.laufzettel}>
                {ergebnis.laufzettel.map((k, i) => (
                  <li key={k.code} className={eigen.laufSchritt}>
                    <span className={eigen.laufNr}>{i + 1}</span>
                    <span className={eigen.laufCode}>{k.code}</span>
                    <span className={styles.cellHint}>{Math.round(k.punkte)} Pkt</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Kartenblock
            titel="Gleichnamige Artikel"
            hinweis="Denselben Artikel haben wir nochmal. Bei Gebrauchtware steht das zweite Exemplar fast immer beim ersten."
            karten={ergebnis.dubletten}
          />
          <Kartenblock
            titel="Nachbar-IDs"
            hinweis="Zusammen angelegt heißt meist zusammen eingeräumt. Die Bilder zeigen, ob die Größe zum vorgeschlagenen Platz passt."
            karten={ergebnis.nachbarn}
          />
          <Kartenblock
            titel="Gleiches Einlagerungsfenster"
            hinweis="Im selben Zeitraum gebucht — kam vermutlich mit derselben Lieferung herein."
            karten={ergebnis.einlagerung}
          />
          <Kartenblock
            titel="Liegt auf dem Soll-Platz"
            hinweis="Diese Artikel stehen dort, wo der gesuchte liegen sollte. Sind sie dort falsch, wurden die beiden womöglich vertauscht."
            karten={ergebnis.aufDemSollplatz}
          />

          {ergebnis.diagnose.length > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Was die Suche gemacht hat</h2>
              </div>
              <ul className={styles.diagnose}>
                {ergebnis.diagnose.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

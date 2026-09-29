'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FREIGABEWORT } from '@/lib/marktplaats/freigabe';
import styles from './marktplaats.module.css';

interface Bestandsaufnahme {
  gesamt: number;
  online: number;
  wartet: number;
  gesperrt: number;
  fehler: number;
}

interface Zeile {
  variationId: number;
  itemId: number | null;
  titel: string;
  massnahme: 'anlegen' | 'aendern' | 'loeschen' | 'nichts' | 'wartet';
  grund: string;
  mpItemId: string | null;
  geschrieben: boolean;
  fehler: string | null;
  befunde: string[];
}

interface Ergebnis {
  ok: boolean;
  probelauf: boolean;
  error: string | null;
  bilanz: { angelegt: number; geaendert: number; geloescht: number; unveraendert: number; wartet: number; fehler: number };
  zeilen: Zeile[];
  weiter: number | null;
  gesehen: number;
  uebersetzt: number;
  diagnose: string[];
  bestand: Bestandsaufnahme | null;
}

interface Vorschlag {
  kategorie: { id: number; name: string; l1Name: string | null; offen: boolean };
  guete: number;
}

/**
 * Liest eine Antwort als JSON — und gibt eine lesbare Meldung, wenn stattdessen
 * eine Fehlerseite kommt (bei einem Timeout schickt Vercel HTML, kein JSON).
 */
async function alsJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const anfang = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(
      res.status === 504 || /timed? ?out|FUNCTION_INVOCATION_TIMEOUT/i.test(text)
        ? 'Zeitüberschreitung — bitte mit einer kleineren Seitengröße erneut versuchen.'
        : `Unerwartete Antwort (HTTP ${res.status}): ${anfang || 'leer'}`,
    );
  }
}

const BADGE: Record<Zeile['massnahme'], string> = {
  anlegen: styles.badgeOk,
  aendern: styles.badgeOk,
  loeschen: styles.badgeWarn,
  wartet: styles.badgeWarn,
  nichts: styles.badgeMuted,
};

const MASSNAHME_TEXT: Record<Zeile['massnahme'], string> = {
  anlegen: 'anlegen',
  aendern: 'ändern',
  loeschen: 'offline',
  wartet: 'wartet',
  nichts: 'unverändert',
};

export default function Marktplaats({
  plentyReady,
  mpReady,
  bestand,
}: {
  plentyReady: boolean;
  mpReady: boolean;
  bestand: Bestandsaufnahme | null;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  // --- Abgleich ------------------------------------------------------------
  const [laeuft, setLaeuft] = useState(false);
  const [seite, setSeite] = useState(1);
  const [proSeite, setProSeite] = useState(50);
  const [maxSchreibend, setMaxSchreibend] = useState(20);
  const [bestaetigung, setBestaetigung] = useState('');
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [aufnahme, setAufnahme] = useState<Bestandsaufnahme | null>(bestand);
  const anhalten = useRef(false);

  // --- Kategorien ----------------------------------------------------------
  const [kategorienAnzahl, setKategorienAnzahl] = useState<number | null>(null);
  const [suche, setSuche] = useState('');
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [zuordnungen, setZuordnungen] = useState<Array<{ stichwort: string; kategorieId: number; kategorieName: string | null }>>([]);

  const ladeZuordnungen = useCallback(async () => {
    try {
      const res = await fetch('/api/marktplaats/zuordnung');
      const daten = await alsJson<{ zeilen: typeof zuordnungen }>(res);
      setZuordnungen(daten.zeilen ?? []);
    } catch {
      // Die Seite bleibt bedienbar, auch wenn die Liste gerade nicht kommt.
    }
  }, []);

  useEffect(() => {
    void ladeZuordnungen();
    void (async () => {
      try {
        const res = await fetch('/api/marktplaats/kategorien');
        const daten = await alsJson<{ anzahl: number }>(res);
        setKategorienAnzahl(daten.anzahl ?? 0);
      } catch {
        setKategorienAnzahl(null);
      }
    })();
  }, [ladeZuordnungen]);

  async function kategorienLaden() {
    setFehler(null);
    setMeldung(null);
    try {
      const res = await fetch('/api/marktplaats/kategorien', { method: 'POST' });
      const daten = await alsJson<{ ok: boolean; geladen: number; offen: number; error?: string }>(res);
      if (!daten.ok) throw new Error(daten.error ?? 'Der Kategoriebaum konnte nicht geladen werden.');
      setKategorienAnzahl(daten.geladen);
      setMeldung(`${daten.geladen} Kategorien geladen, davon ${daten.offen} offen.`);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    }
  }

  async function suchen(begriff: string) {
    setSuche(begriff);
    if (begriff.trim().length < 3) {
      setVorschlaege([]);
      return;
    }
    try {
      const res = await fetch(`/api/marktplaats/kategorien?suche=${encodeURIComponent(begriff)}`);
      const daten = await alsJson<{ vorschlaege: Vorschlag[] }>(res);
      setVorschlaege(daten.vorschlaege ?? []);
    } catch {
      setVorschlaege([]);
    }
  }

  async function zuordnen(kategorieId: number, kategorieName: string) {
    setFehler(null);
    try {
      const res = await fetch('/api/marktplaats/zuordnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stichwort: suche, kategorieId, kategorieName }),
      });
      const daten = await alsJson<{ ok: boolean; fehler?: string }>(res);
      if (!daten.ok) throw new Error(daten.fehler ?? 'Die Zuordnung ließ sich nicht speichern.');
      setMeldung(`„${suche}" → ${kategorieName}`);
      setSuche('');
      setVorschlaege([]);
      await ladeZuordnungen();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    }
  }

  async function zuordnungLoeschen(stichwort: string) {
    await fetch(`/api/marktplaats/zuordnung?stichwort=${encodeURIComponent(stichwort)}`, { method: 'DELETE' });
    await ladeZuordnungen();
  }

  /**
   * Startet den Abgleich und hängt selbstständig an, bis `weiter` null ist.
   *
   * Der Lauf läuft in Häppchen unter dem Serverless-Zeitlimit; ohne das
   * Nachhängen müsste jemand hundertmal auf denselben Knopf drücken.
   */
  async function abgleichen(probelauf: boolean) {
    setFehler(null);
    setMeldung(null);
    setLaeuft(true);
    anhalten.current = false;

    let naechste: number | null = seite;
    const gesammelt: Zeile[] = [];
    const bilanz = { angelegt: 0, geaendert: 0, geloescht: 0, unveraendert: 0, wartet: 0, fehler: 0 };
    let gesehen = 0;
    let uebersetzt = 0;

    try {
      while (naechste !== null && !anhalten.current) {
        const res: Response = await fetch('/api/marktplaats/abgleich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            probelauf,
            bestaetigung: probelauf ? undefined : bestaetigung,
            seite: naechste,
            proSeite,
            maxSchreibend,
          }),
        });
        const daten: Ergebnis & { error?: string } = await alsJson<Ergebnis & { error?: string }>(res);
        if (!daten.ok) throw new Error(daten.error ?? 'Der Abgleich ist fehlgeschlagen.');

        gesammelt.push(...daten.zeilen);
        for (const k of Object.keys(bilanz) as Array<keyof typeof bilanz>) bilanz[k] += daten.bilanz[k];
        gesehen += daten.gesehen;
        uebersetzt += daten.uebersetzt;
        setAufnahme(daten.bestand);
        setErgebnis({
          ...daten,
          // Nur die letzten Zeilen behalten — bei zehntausend Artikeln wird
          // der Browser sonst langsam, und weiter oben schaut ohnehin niemand.
          zeilen: gesammelt.slice(-300),
          bilanz: { ...bilanz },
          gesehen,
          uebersetzt,
        });

        // Bleibt der Lauf auf derselben Seite stehen, hat er dort abgebrochen
        // (Zeitbudget oder Obergrenze) und macht genau dort weiter.
        naechste = daten.weiter;
        if (naechste !== null) setSeite(naechste);
      }
      if (anhalten.current) setMeldung('Angehalten. Der bisherige Stand bleibt stehen.');
      else {
        setMeldung(probelauf ? 'Probelauf durch — es wurde nichts verändert.' : 'Abgleich durch.');
        setSeite(1);
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    } finally {
      setLaeuft(false);
    }
  }

  const darfSchreiben = mpReady && plentyReady && bestaetigung === FREIGABEWORT;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Marktplaats.nl</span>
        <h1 className={styles.title}>Artikel nach Marktplaats</h1>
        <p className={styles.subtitle}>
          Jeder Artikel mit Bestand wird zu einer Anzeige bei Marktplaats — Titel und Text auf
          Niederländisch, Preis aus der Webshop-Preisliste. Fällt der Bestand auf null, kommt die
          Anzeige offline. Was keiner Kategorie zugeordnet ist, bleibt liegen und wird gezählt.
        </p>
      </header>

      {!plentyReady && <p className={`${styles.notice} ${styles.noticeWarn}`}>PlentyONE ist nicht eingerichtet — ohne Zugang gibt es keinen Bestand zu lesen.</p>}
      {!mpReady && (
        <p className={`${styles.notice} ${styles.noticeWarn}`}>
          Der Marktplaats-Zugang ist unvollständig. Unter „Einstellungen" Client-ID, Client-Secret,
          API-Adresse und die niederländische Postleitzahl des Lagers eintragen.
        </p>
      )}
      {fehler && <p className={`${styles.notice} ${styles.noticeErr}`}>{fehler}</p>}
      {meldung && <p className={`${styles.notice} ${styles.noticeOk}`}>{meldung}</p>}

      {aufnahme && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Stand</h2>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statOk}`}>{aufnahme.online}</div>
              <div className={styles.statLabel}>online</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statWarn}`}>{aufnahme.wartet}</div>
              <div className={styles.statLabel}>wartet</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statWarn}`}>{aufnahme.gesperrt}</div>
              <div className={styles.statLabel}>gesperrt</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statErr}`}>{aufnahme.fehler}</div>
              <div className={styles.statLabel}>Fehler</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>{aufnahme.gesamt}</div>
              <div className={styles.statLabel}>bekannt</div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>1 · Kategorien zuordnen</h2>
          <span className={styles.cellHint}>
            {kategorienAnzahl === null ? 'Kategoriebaum unbekannt' : `${kategorienAnzahl} Kategorien abgelegt`}
          </span>
        </div>

        <p className={styles.hint}>
          Eine Anzeige braucht eine L2-Kategorie von Marktplaats. Zwischen einem deutschen Sortiment
          und niederländischen Rubriken liegt keine Regel, sondern eine Entscheidung — deshalb wird
          hier zugeordnet und beim Abgleich nichts geraten.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={kategorienLaden} disabled={!mpReady}>
            Kategoriebaum laden
          </button>
        </div>

        <div className={styles.controls} style={{ marginTop: 'var(--space-5)' }}>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="suche">
              Stichwort aus dem eigenen Sortiment
            </label>
            <input
              id="suche"
              className={styles.input}
              value={suche}
              onChange={(e) => void suchen(e.target.value)}
              placeholder="z. B. Bohrmaschinen"
            />
          </div>
        </div>

        {vorschlaege.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            {vorschlaege.map((v) => (
              <div key={v.kategorie.id} className={styles.vorschlag}>
                <span>
                  {v.kategorie.l1Name ? `${v.kategorie.l1Name} · ` : ''}
                  {v.kategorie.name} <span className={styles.mono}>#{v.kategorie.id}</span>
                </span>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void zuordnen(v.kategorie.id, v.kategorie.name)}
                >
                  zuordnen
                </button>
              </div>
            ))}
          </div>
        )}

        {zuordnungen.length > 0 && (
          <div className={styles.tableWrap} style={{ marginTop: 'var(--space-5)' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Stichwort</th>
                  <th>Marktplaats-Kategorie</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {zuordnungen.map((z) => (
                  <tr key={z.stichwort}>
                    <td className={styles.mono}>{z.stichwort}</td>
                    <td>
                      {z.kategorieName ?? '—'} <span className={styles.mono}>#{z.kategorieId}</span>
                    </td>
                    <td>
                      <button type="button" className={styles.secondary} onClick={() => void zuordnungLoeschen(z.stichwort)}>
                        entfernen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>2 · Abgleich</h2>
        </div>

        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="seite">Ab Bestandsseite</label>
            <input
              id="seite"
              className={styles.input}
              type="number"
              min={1}
              value={seite}
              onChange={(e) => setSeite(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="proSeite">Artikel je Seite</label>
            <input
              id="proSeite"
              className={styles.input}
              type="number"
              min={10}
              max={250}
              value={proSeite}
              onChange={(e) => setProSeite(Number(e.target.value) || 50)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="maxSchreibend">Änderungen je Häppchen</label>
            <input
              id="maxSchreibend"
              className={styles.input}
              type="number"
              min={1}
              max={500}
              value={maxSchreibend}
              onChange={(e) => setMaxSchreibend(Number(e.target.value) || 20)}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void abgleichen(true)} disabled={laeuft || !plentyReady || !mpReady}>
            {laeuft ? 'läuft …' : 'Probelauf'}
          </button>
          {laeuft && (
            <button type="button" className={styles.secondary} onClick={() => { anhalten.current = true; }}>
              Anhalten
            </button>
          )}
        </div>

        <p className={styles.hint}>
          Der Probelauf verändert bei Marktplaats nichts. Erst der Knopf darunter veröffentlicht —
          und dafür muss <strong>{FREIGABEWORT}</strong> eingetippt werden. Zuerst zwanzig Artikel,
          nachsehen, wie sie bei Marktplaats aussehen, dann größere Blöcke.
        </p>

        <div className={styles.controls} style={{ marginTop: 'var(--space-4)' }}>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="bestaetigung">Zum Veröffentlichen „{FREIGABEWORT}" eintippen</label>
            <input
              id="bestaetigung"
              className={styles.input}
              value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value.toUpperCase())}
              placeholder={FREIGABEWORT}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.danger} onClick={() => void abgleichen(false)} disabled={laeuft || !darfSchreiben}>
            Veröffentlichen
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {ergebnis && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{ergebnis.probelauf ? 'Probelauf' : 'Lauf'}</h2>
            <span className={styles.cellHint}>
              {ergebnis.gesehen} Artikel angesehen, {ergebnis.uebersetzt} übersetzt
            </span>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statOk}`}>{ergebnis.bilanz.angelegt}</div>
              <div className={styles.statLabel}>angelegt</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statOk}`}>{ergebnis.bilanz.geaendert}</div>
              <div className={styles.statLabel}>geändert</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statWarn}`}>{ergebnis.bilanz.geloescht}</div>
              <div className={styles.statLabel}>offline</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statWarn}`}>{ergebnis.bilanz.wartet}</div>
              <div className={styles.statLabel}>wartet</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>{ergebnis.bilanz.unveraendert}</div>
              <div className={styles.statLabel}>unverändert</div>
            </div>
            <div className={styles.stat}>
              <div className={`${styles.statNum} ${styles.statErr}`}>{ergebnis.bilanz.fehler}</div>
              <div className={styles.statLabel}>Fehler</div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Artikel</th>
                  <th>Maßnahme</th>
                  <th>Grund</th>
                  <th>Anzeige</th>
                </tr>
              </thead>
              <tbody>
                {ergebnis.zeilen.map((z) => (
                  <tr key={z.variationId}>
                    <td>
                      {z.titel}
                      <div className={styles.cellHint}>
                        Artikel {z.itemId ?? '—'} · Variante {z.variationId}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${BADGE[z.massnahme]}`}>{MASSNAHME_TEXT[z.massnahme]}</span>
                      {z.geschrieben && <div className={styles.cellHint}>ausgeführt</div>}
                    </td>
                    <td>
                      {z.fehler ? <span className={styles.statErr}>{z.fehler}</span> : z.grund}
                      {z.befunde.length > 0 && (
                        <div className={styles.cellHint}>{z.befunde.join(' · ')}</div>
                      )}
                    </td>
                    <td className={styles.mono}>{z.mpItemId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ergebnis.zeilen.length === 0 && <p className={styles.empty}>Keine Artikel in diesem Häppchen.</p>}

          {ergebnis.diagnose.length > 0 && (
            <ul className={styles.diagnose}>
              {ergebnis.diagnose.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

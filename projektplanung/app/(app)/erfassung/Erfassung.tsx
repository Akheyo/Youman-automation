'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './erfassung.module.css';
import {
  ROLLEN,
  ROLLE_HINWEIS,
  ROLLE_TEXT,
  PFLICHT_ROLLEN,
  STATUS_TEXT,
  bereitHinweis,
  istStatus,
  validiereBild,
  type Rolle,
} from '@/lib/erfassung/logic';
import {
  beobachte,
  einreihen,
  laeuftNurImArbeitsspeicher,
  nochmal,
  verwerfen,
  verwerfeArtikel,
  vergissArtikel,
  vorschau,
  arbeite,
  wiederAufnehmen,
  type Eintrag,
  type EintragStatus,
} from '@/lib/erfassung/warteschlange';

interface ServerBild {
  id: string;
  rolle: string;
  position: number;
  hochgeladen: boolean;
  url?: string | null;
}
interface ServerArtikel {
  id: string;
  nummer: number;
  status: string;
  notiz: string | null;
  erfasst_von: string | null;
  created_at: string;
  fertig_am: string | null;
  fehler: string | null;
  bilder: ServerBild[] | null;
}

/** Ein Foto in der Oberfläche — egal ob es noch in der Reihe steht oder schon oben ist. */
interface Foto {
  schluessel: string;
  rolle: Rolle;
  bild?: string;
  status: EintragStatus;
  meldung?: string;
  queueId?: string;
}

async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unerwartete Antwort (HTTP ${res.status}).`);
  }
}

function istRolleSicher(wert: string): Rolle {
  return (ROLLEN as readonly string[]).includes(wert) ? (wert as Rolle) : 'detail';
}

function uhrzeit(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function Erfassung() {
  const [artikel, setArtikel] = useState<{ id: string; nummer: number } | null>(null);
  const [serverBilder, setServerBilder] = useState<ServerBild[]>([]);
  const [reihe, setReihe] = useState<Eintrag[]>([]);
  const [liste, setListe] = useState<ServerArtikel[]>([]);
  const [notiz, setNotiz] = useState('');
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [startet, setStartet] = useState(true);
  const [online, setOnline] = useState(true);

  const rolleRef = useRef<Rolle>('uebersicht');
  // Verhindert, dass ein doppelter Mount (React StrictMode, schneller
  // Seitenwechsel) zwei leere Artikel anlegt.
  const gestartetRef = useRef(false);
  const kameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Laden und Sitzung
  // -------------------------------------------------------------------------

  const ladeListe = useCallback(async () => {
    try {
      const res = await fetch('/api/erfassung/artikel', { cache: 'no-store' });
      const daten = await alsJson(res);
      if (res.ok) setListe((daten.artikel as ServerArtikel[]) ?? []);
    } catch {
      /* die Liste ist Beiwerk – ein Fehler hier darf das Fotografieren nicht stören */
    }
  }, []);

  /**
   * Sucht einen angefangenen Artikel dieses Nutzers und macht dort weiter.
   * Nur wenn keiner offen ist, entsteht ein neuer.
   *
   * Das ist der Grund, warum man die App zumachen kann, ohne etwas zu
   * verlieren — und warum nicht bei jedem Öffnen eine leere Karteileiche
   * angelegt wird.
   */
  const starteSitzung = useCallback(async () => {
    setStartet(true);
    try {
      const res = await fetch('/api/erfassung/artikel?status=offen&mein=1', { cache: 'no-store' });
      const daten = await alsJson(res);
      if (!res.ok) throw new Error(String(daten.error ?? 'Laden fehlgeschlagen.'));
      const offene = (daten.artikel as ServerArtikel[]) ?? [];
      if (offene.length > 0) {
        const a = offene[0];
        setArtikel({ id: a.id, nummer: a.nummer });
        setServerBilder((a.bilder ?? []).filter((b) => b.hochgeladen));
        setNotiz(a.notiz ?? '');
      } else {
        await neuerArtikel();
      }
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setStartet(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const neuerArtikel = useCallback(async () => {
    const res = await fetch('/api/erfassung/artikel', { method: 'POST' });
    const daten = await alsJson(res);
    if (!res.ok) throw new Error(String(daten.error ?? 'Artikel anlegen fehlgeschlagen.'));
    const a = daten.artikel as { id: string; nummer: number };
    setArtikel({ id: a.id, nummer: a.nummer });
    setServerBilder([]);
    setNotiz('');
  }, []);

  useEffect(() => {
    const ab = beobachte(setReihe);
    void wiederAufnehmen();
    if (!gestartetRef.current) {
      gestartetRef.current = true;
      void starteSitzung().then(ladeListe);
    }
    return ab;
  }, [starteSitzung, ladeListe]);

  // Netzwechsel: sobald wieder Netz da ist, läuft die Reihe von selbst weiter.
  useEffect(() => {
    const setzen = () => {
      const da = navigator.onLine !== false;
      setOnline(da);
      if (da) void arbeite();
    };
    setzen();
    window.addEventListener('online', setzen);
    window.addEventListener('offline', setzen);
    return () => {
      window.removeEventListener('online', setzen);
      window.removeEventListener('offline', setzen);
    };
  }, []);

  // Vom Startbildschirm aus installierbar machen.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ohne Service Worker läuft alles weiter, nur die Installation fehlt */
      });
    }
  }, []);

  // -------------------------------------------------------------------------
  // Fotos aufnehmen
  // -------------------------------------------------------------------------

  const oeffneKamera = (rolle: Rolle) => {
    rolleRef.current = rolle;
    kameraRef.current?.click();
  };

  const dateienUebernehmen = async (dateien: FileList | null, rolle: Rolle) => {
    if (!dateien || dateien.length === 0 || !artikel) return;
    for (const datei of Array.from(dateien)) {
      const fehler = validiereBild({ contentType: datei.type, groesse: datei.size });
      if (fehler) {
        setMeldung({ art: 'fehler', text: `${datei.name}: ${fehler}` });
        continue;
      }
      await einreihen(artikel.id, rolle, datei);
    }
  };

  // -------------------------------------------------------------------------
  // Abschicken und verwerfen
  // -------------------------------------------------------------------------

  const fotos: Foto[] = useMemo(() => {
    if (!artikel) return [];
    const ausServer: Foto[] = serverBilder.map((b) => ({
      schluessel: `s-${b.id}`,
      rolle: istRolleSicher(b.rolle),
      bild: b.url ?? undefined,
      status: 'oben' as EintragStatus,
    }));
    const ausReihe: Foto[] = reihe
      .filter((e) => e.artikelId === artikel.id)
      .map((e) => ({
        schluessel: `w-${e.id}`,
        rolle: e.rolle,
        bild: vorschau(e.id),
        status: e.status,
        meldung: e.meldung,
        queueId: e.id,
      }));
    return [...ausServer, ...ausReihe];
  }, [artikel, serverBilder, reihe]);

  const obenListe = useMemo(
    () => fotos.filter((f) => f.status === 'oben').map((f) => ({ rolle: f.rolle as string, hochgeladen: true })),
    [fotos],
  );
  const hinweis = bereitHinweis(obenListe);
  const offeneUploads = fotos.filter((f) => f.status === 'wartet' || f.status === 'laedt').length;
  const fehlerhafte = fotos.filter((f) => f.status === 'fehler').length;

  const fertig = async () => {
    if (!artikel || beschaeftigt) return;
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      const res = await fetch(`/api/erfassung/artikel/${artikel.id}/fertig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notiz }),
      });
      const daten = await alsJson(res);
      if (!res.ok) throw new Error(String(daten.error ?? 'Abschicken fehlgeschlagen.'));
      const nummer = artikel.nummer;
      await vergissArtikel(artikel.id);
      await neuerArtikel();
      setMeldung({ art: 'ok', text: `Artikel ${nummer} ist durch. Weiter mit dem nächsten.` });
      void ladeListe();
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBeschaeftigt(false);
    }
  };

  const artikelVerwerfen = async () => {
    if (!artikel || beschaeftigt) return;
    if (!window.confirm(`Artikel ${artikel.nummer} mit allen Fotos verwerfen?`)) return;
    setBeschaeftigt(true);
    try {
      await verwerfeArtikel(artikel.id);
      await fetch(`/api/erfassung/artikel/${artikel.id}`, { method: 'DELETE' });
      await neuerArtikel();
      setMeldung(null);
      void ladeListe();
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBeschaeftigt(false);
    }
  };

  // -------------------------------------------------------------------------
  // Darstellung
  // -------------------------------------------------------------------------

  return (
    <div className={styles.seite}>
      <input
        ref={kameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(e) => {
          void dateienUebernehmen(e.target.files, rolleRef.current);
          e.target.value = '';
        }}
      />
      <input
        ref={galerieRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={(e) => {
          void dateienUebernehmen(e.target.files, 'detail');
          e.target.value = '';
        }}
      />

      <header className={styles.kopf}>
        <div>
          <p className={styles.kopfLabel}>Artikel</p>
          <h1 className={styles.nummer}>{artikel ? artikel.nummer : startet ? '…' : '—'}</h1>
        </div>
        <button type="button" className={styles.verwerfen} onClick={artikelVerwerfen} disabled={!artikel || beschaeftigt}>
          Verwerfen
        </button>
      </header>

      {!online && (
        <p className={`${styles.leiste} ${styles.leisteWarnung}`}>
          Kein Netz. Weiterfotografieren ist in Ordnung — die Fotos gehen raus, sobald wieder Empfang da ist.
        </p>
      )}
      {laeuftNurImArbeitsspeicher() && (
        <p className={`${styles.leiste} ${styles.leisteWarnung}`}>
          Dieser Browser erlaubt keinen lokalen Zwischenspeicher (privater Modus?). Die Seite bitte offen lassen, bis
          alle Fotos oben sind.
        </p>
      )}
      {meldung && (
        <p className={`${styles.leiste} ${meldung.art === 'ok' ? styles.leisteOk : styles.leisteFehler}`}>
          {meldung.text}
        </p>
      )}

      <section className={styles.kacheln}>
        {ROLLEN.map((rolle) => {
          const eigene = fotos.filter((f) => f.rolle === rolle);
          const pflicht = PFLICHT_ROLLEN.includes(rolle);
          const erfuellt = eigene.some((f) => f.status === 'oben');
          return (
            <article key={rolle} className={`${styles.kachel} ${pflicht && !erfuellt ? styles.kachelOffen : ''}`}>
              <button
                type="button"
                className={styles.kachelKnopf}
                onClick={() => oeffneKamera(rolle)}
                disabled={!artikel || beschaeftigt}
              >
                <span className={styles.kachelTitel}>
                  {ROLLE_TEXT[rolle]}
                  {pflicht && <span className={styles.pflicht} title="Pflichtaufnahme"> *</span>}
                </span>
                <span className={styles.kachelHinweis}>{ROLLE_HINWEIS[rolle]}</span>
                <span className={styles.kachelAktion}>{eigene.length > 0 ? 'Noch eins' : 'Foto aufnehmen'}</span>
              </button>

              {eigene.length > 0 && (
                <ul className={styles.streifen}>
                  {eigene.map((f) => (
                    <li key={f.schluessel} className={styles.miniatur}>
                      {f.bild ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.bild} alt="" />
                      ) : (
                        <span className={styles.ohneBild} aria-hidden />
                      )}
                      <span className={`${styles.punkt} ${styles[`punkt_${f.status}`]}`} title={f.meldung ?? f.status} />
                      {f.queueId && (
                        <button
                          type="button"
                          className={styles.weg}
                          onClick={() => void verwerfen(f.queueId!)}
                          aria-label="Foto verwerfen"
                        >
                          ×
                        </button>
                      )}
                      {f.status === 'fehler' && f.queueId && (
                        <button type="button" className={styles.nochmal} onClick={() => void nochmal(f.queueId!)}>
                          nochmal
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      <button
        type="button"
        className={styles.galerie}
        onClick={() => galerieRef.current?.click()}
        disabled={!artikel || beschaeftigt}
      >
        Aus der Galerie hinzufügen
      </button>

      <label className={styles.notizFeld}>
        <span>Notiz (was das Foto nicht zeigt)</span>
        <textarea
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          rows={2}
          placeholder="z. B. Fernbedienung fehlt, Kabel dabei"
          maxLength={500}
        />
      </label>

      <div className={styles.fuss}>
        <div className={styles.fussInfo}>
          {offeneUploads > 0 && <span>{offeneUploads} Foto(s) werden noch übertragen</span>}
          {fehlerhafte > 0 && <span className={styles.fussFehler}>{fehlerhafte} hängen — bitte „nochmal“</span>}
          {offeneUploads === 0 && fehlerhafte === 0 && hinweis && <span>{hinweis}</span>}
          {offeneUploads === 0 && fehlerhafte === 0 && !hinweis && <span>Alle Pflichtaufnahmen sind da.</span>}
        </div>
        <button
          type="button"
          className={styles.fertig}
          onClick={fertig}
          disabled={!artikel || beschaeftigt || Boolean(hinweis) || offeneUploads > 0 || fehlerhafte > 0}
        >
          {beschaeftigt ? 'einen Moment …' : 'Artikel fertig'}
        </button>
      </div>

      <section className={styles.verlauf}>
        <h2>Zuletzt erfasst</h2>
        {liste.length === 0 && <p className={styles.leer}>Noch nichts erfasst.</p>}
        <ul>
          {liste.map((a) => {
            const anzahl = (a.bilder ?? []).filter((b) => b.hochgeladen).length;
            const status = istStatus(a.status) ? STATUS_TEXT[a.status] : a.status;
            return (
              <li key={a.id}>
                <span className={styles.verlaufNummer}>{a.nummer}</span>
                <span className={`${styles.marke} ${a.status === 'fehler' ? styles.markeFehler : ''}`}>{status}</span>
                <span className={styles.verlaufMeta}>
                  {anzahl} Bild{anzahl === 1 ? '' : 'er'} · {uhrzeit(a.fertig_am ?? a.created_at)}
                  {a.erfasst_von ? ` · ${a.erfasst_von}` : ''}
                </span>
                {a.fehler && <span className={styles.verlaufFehler}>{a.fehler}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

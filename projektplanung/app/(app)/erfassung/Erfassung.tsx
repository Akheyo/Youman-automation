'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './erfassung.module.css';
import {
  ERKANNTE_ROLLE_TEXT,
  STATUS_TEXT,
  artikelBereit,
  bereitHinweis,
  istStatus,
  validiereBild,
  type ErkannteRolle,
} from '@/lib/erfassung/logic';
import { ZUSTAND_TEXT, type Erkennung } from '@/lib/erfassung/erkennung';
import type { Treffer } from '@/lib/erfassung/treffer';
import {
  arbeite,
  beobachte,
  einreihen,
  laeuftNurImArbeitsspeicher,
  nochmal,
  vergissArtikel,
  verwerfeArtikel,
  verwerfen,
  vorschau,
  wiederAufnehmen,
  type Eintrag,
  type EintragStatus,
} from '@/lib/erfassung/warteschlange';

interface ServerBild {
  id: string;
  rolle: string;
  rolle_erkannt: string | null;
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
  erkennung: Erkennung | null;
  treffer: { treffer: Treffer[]; diagnose: string[] } | null;
  erkannt_am: string | null;
  erkennung_fehler: string | null;
  bilder: ServerBild[] | null;
}

/** Ein Foto in der Oberfläche — egal ob noch in der Reihe oder schon oben. */
interface Foto {
  schluessel: string;
  bild?: string;
  status: EintragStatus;
  meldung?: string;
  queueId?: string;
  rolle?: string | null;
}

async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unerwartete Antwort (HTTP ${res.status}).`);
  }
}

function uhrzeit(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function rolleText(rolle: string | null | undefined): string | null {
  if (!rolle) return null;
  return ERKANNTE_ROLLE_TEXT[rolle as ErkannteRolle] ?? rolle;
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
  /** Welcher Artikel wird gerade ausgewertet — für die Anzeige in der Liste. */
  const [wertetAus, setWertetAus] = useState<string | null>(null);

  const kameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  const gestartetRef = useRef(false);
  const auswertungLaeuft = useRef(false);
  /**
   * Schon angestoßene Auswertungen. Ohne das würde ein Artikel, dessen
   * Auswertung nicht durchgeht (z. B. fehlender API-Schlüssel), bei jedem
   * Listenaufruf erneut angestoßen — eine Schleife, die Geld kostet.
   */
  const versuchtRef = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Auswertung — läuft von selbst
  // -------------------------------------------------------------------------

  const ladeListe = useCallback(async (): Promise<ServerArtikel[]> => {
    try {
      const res = await fetch('/api/erfassung/artikel', { cache: 'no-store' });
      const daten = await alsJson(res);
      if (!res.ok) return [];
      const artikel = (daten.artikel as ServerArtikel[]) ?? [];
      setListe(artikel);
      return artikel;
    } catch {
      // Die Liste ist Beiwerk — ein Fehler hier darf das Fotografieren nicht stören.
      return [];
    }
  }, []);

  /**
   * Wertet alles aus, was auf "bereit" steht — eines nach dem anderen.
   *
   * Angestoßen wird das nach dem Abschicken und bei jedem Laden der Liste.
   * Damit läuft ein Artikel ohne weiteres Zutun durch: fotografieren, fertig,
   * und während schon der nächste auf dem Tisch liegt, wird der vorige
   * ausgewertet. Bleibt einer liegen, weil jemand die App zugemacht hat, holt
   * ihn der nächste Aufruf nach.
   */
  const auswertenNachziehen = useCallback(
    async (artikelListe: ServerArtikel[]) => {
      if (auswertungLaeuft.current) return;
      const offen = artikelListe.filter((a) => a.status === 'bereit' && !versuchtRef.current.has(a.id));
      if (offen.length === 0) return;

      auswertungLaeuft.current = true;
      try {
        for (const eintrag of offen) {
          versuchtRef.current.add(eintrag.id);
          setWertetAus(eintrag.id);
          try {
            const res = await fetch(`/api/erfassung/artikel/${eintrag.id}/erkennen`, { method: 'POST' });
            const daten = await alsJson(res);
            if (!res.ok) {
              setMeldung({ art: 'fehler', text: `Artikel ${eintrag.nummer}: ${String(daten.error ?? 'Auswertung fehlgeschlagen.')}` });
            } else {
              const hinweise = (daten.hinweise as string[]) ?? [];
              if (hinweise.length > 0) setMeldung({ art: 'fehler', text: `Artikel ${eintrag.nummer}: ${hinweise[0]}` });
            }
          } catch (e) {
            setMeldung({
              art: 'fehler',
              text: `Artikel ${eintrag.nummer}: ${e instanceof Error ? e.message : String(e)}`,
            });
          } finally {
            setWertetAus(null);
          }
          await ladeListe();
        }
      } finally {
        auswertungLaeuft.current = false;
      }
    },
    [ladeListe],
  );

  const listeUndAuswertung = useCallback(async () => {
    const artikelListe = await ladeListe();
    void auswertenNachziehen(artikelListe);
  }, [ladeListe, auswertenNachziehen]);

  /**
   * Von Hand nachziehen.
   *
   * Ein Artikel, dessen Auswertung schiefgegangen ist, wird in derselben
   * Sitzung nicht von allein erneut angestoßen (sonst liefe eine Schleife).
   * Ohne diesen Knopf bliebe er stumm liegen, und genau das soll nicht
   * passieren.
   */
  const erneutAuswerten = useCallback(
    async (id: string, nummer: number) => {
      if (auswertungLaeuft.current) return;
      auswertungLaeuft.current = true;
      setWertetAus(id);
      setMeldung(null);
      try {
        const res = await fetch(`/api/erfassung/artikel/${id}/erkennen`, { method: 'POST' });
        const daten = await alsJson(res);
        if (!res.ok) throw new Error(String(daten.error ?? 'Auswertung fehlgeschlagen.'));
        const hinweise = (daten.hinweise as string[]) ?? [];
        if (hinweise.length > 0) setMeldung({ art: 'fehler', text: `Artikel ${nummer}: ${hinweise[0]}` });
      } catch (e) {
        setMeldung({ art: 'fehler', text: `Artikel ${nummer}: ${e instanceof Error ? e.message : String(e)}` });
      } finally {
        setWertetAus(null);
        auswertungLaeuft.current = false;
        await ladeListe();
      }
    },
    [ladeListe],
  );

  // -------------------------------------------------------------------------
  // Sitzung
  // -------------------------------------------------------------------------

  const neuerArtikel = useCallback(async () => {
    const res = await fetch('/api/erfassung/artikel', { method: 'POST' });
    const daten = await alsJson(res);
    if (!res.ok) throw new Error(String(daten.error ?? 'Artikel anlegen fehlgeschlagen.'));
    const a = daten.artikel as { id: string; nummer: number };
    setArtikel({ id: a.id, nummer: a.nummer });
    setServerBilder([]);
    setNotiz('');
  }, []);

  /**
   * Setzt einen angefangenen Artikel fort, sonst entsteht ein neuer. Deshalb
   * kostet ein versehentliches Öffnen keine Karteileiche.
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
  }, [neuerArtikel]);

  useEffect(() => {
    const ab = beobachte(setReihe);
    void wiederAufnehmen();
    if (!gestartetRef.current) {
      gestartetRef.current = true;
      void starteSitzung().then(listeUndAuswertung);
    }
    return ab;
  }, [starteSitzung, listeUndAuswertung]);

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

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ohne Service Worker läuft alles weiter, nur die Installation fehlt */
      });
    }
  }, []);

  // -------------------------------------------------------------------------
  // Fotografieren
  // -------------------------------------------------------------------------

  const dateienUebernehmen = async (dateien: FileList | null) => {
    if (!dateien || dateien.length === 0 || !artikel) return;
    for (const datei of Array.from(dateien)) {
      const fehler = validiereBild({ contentType: datei.type, groesse: datei.size });
      if (fehler) {
        setMeldung({ art: 'fehler', text: `${datei.name}: ${fehler}` });
        continue;
      }
      // Wofür ein Foto taugt, entscheidet die Auswertung. Am Regal wird
      // fotografiert, nicht sortiert.
      await einreihen(artikel.id, 'detail', datei);
    }
  };

  const fotos: Foto[] = useMemo(() => {
    if (!artikel) return [];
    const ausServer: Foto[] = serverBilder.map((b) => ({
      schluessel: `s-${b.id}`,
      bild: b.url ?? undefined,
      status: 'oben' as EintragStatus,
      rolle: b.rolle_erkannt,
    }));
    const ausReihe: Foto[] = reihe
      .filter((e) => e.artikelId === artikel.id)
      .map((e) => ({
        schluessel: `w-${e.id}`,
        bild: vorschau(e.id),
        status: e.status,
        meldung: e.meldung,
        queueId: e.id,
      }));
    return [...ausServer, ...ausReihe];
  }, [artikel, serverBilder, reihe]);

  const obenListe = useMemo(() => fotos.filter((f) => f.status === 'oben').map(() => ({ hochgeladen: true })), [fotos]);
  const hinweis = bereitHinweis(obenListe);
  const offeneUploads = fotos.filter((f) => f.status === 'wartet' || f.status === 'laedt').length;
  const fehlerhafte = fotos.filter((f) => f.status === 'fehler').length;
  const kannAbschicken =
    Boolean(artikel) && !beschaeftigt && artikelBereit(obenListe) && offeneUploads === 0 && fehlerhafte === 0;

  // -------------------------------------------------------------------------
  // Abschicken
  // -------------------------------------------------------------------------

  const fertig = async () => {
    if (!artikel || !kannAbschicken) return;
    setBeschaeftigt(true);
    setMeldung(null);
    const fertiger = artikel;
    try {
      const res = await fetch(`/api/erfassung/artikel/${fertiger.id}/fertig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notiz }),
      });
      const daten = await alsJson(res);
      if (!res.ok) throw new Error(String(daten.error ?? 'Abschicken fehlgeschlagen.'));

      await vergissArtikel(fertiger.id);
      await neuerArtikel();
      setMeldung({ art: 'ok', text: `Artikel ${fertiger.nummer} ist durch — wird jetzt ausgewertet.` });
      // Die Auswertung läuft im Hintergrund weiter, während schon der nächste
      // Artikel fotografiert wird.
      void listeUndAuswertung();
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
          void dateienUebernehmen(e.target.files);
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
          void dateienUebernehmen(e.target.files);
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

      <button
        type="button"
        className={styles.aufnehmen}
        onClick={() => kameraRef.current?.click()}
        disabled={!artikel || beschaeftigt}
      >
        <span className={styles.aufnehmenGross}>Foto aufnehmen</span>
        <span className={styles.aufnehmenKlein}>
          So viele wie nötig — Übersicht, Typenschild, Schäden. Sortieren macht die Auswertung.
        </span>
      </button>

      {fotos.length > 0 && (
        <ul className={styles.streifen}>
          {fotos.map((f) => (
            <li key={f.schluessel} className={styles.miniatur}>
              {f.bild ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.bild} alt="" />
              ) : (
                <span className={styles.ohneBild} aria-hidden />
              )}
              <span className={`${styles.punkt} ${styles[`punkt_${f.status}`]}`} title={f.meldung ?? f.status} />
              {rolleText(f.rolle) && <span className={styles.rolleMarke}>{rolleText(f.rolle)}</span>}
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

      <button
        type="button"
        className={styles.galerie}
        onClick={() => galerieRef.current?.click()}
        disabled={!artikel || beschaeftigt}
      >
        Aus der Galerie hinzufügen
      </button>

      <label className={styles.notizFeld}>
        <span>Notiz — nur was man auf den Fotos nicht sieht</span>
        <textarea
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          rows={2}
          placeholder="z. B. läuft nicht an, Fernbedienung fehlt"
          maxLength={500}
        />
      </label>

      <div className={styles.fuss}>
        <div className={styles.fussInfo}>
          {offeneUploads > 0 && <span>{offeneUploads} Foto(s) werden noch übertragen</span>}
          {fehlerhafte > 0 && <span className={styles.fussFehler}>{fehlerhafte} hängen — bitte „nochmal“</span>}
          {offeneUploads === 0 && fehlerhafte === 0 && hinweis && <span>{hinweis}</span>}
          {offeneUploads === 0 && fehlerhafte === 0 && !hinweis && (
            <span>
              {obenListe.length} Foto{obenListe.length === 1 ? '' : 's'} übertragen
            </span>
          )}
        </div>
        <button type="button" className={styles.fertig} onClick={fertig} disabled={!kannAbschicken}>
          {beschaeftigt ? 'einen Moment …' : 'Artikel fertig'}
        </button>
      </div>

      <section className={styles.verlauf}>
        <h2>Zuletzt erfasst</h2>
        {liste.length === 0 && <p className={styles.leer}>Noch nichts erfasst.</p>}
        <ul>
          {liste.map((a) => (
            <ArtikelZeile
              key={a.id}
              artikel={a}
              wertetAus={wertetAus === a.id}
              onErneutAuswerten={erneutAuswerten}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Eine Zeile im Verlauf — mit dem, was die Auswertung gefunden hat. */
function ArtikelZeile({
  artikel,
  wertetAus,
  onErneutAuswerten,
}: {
  artikel: ServerArtikel;
  wertetAus: boolean;
  onErneutAuswerten: (id: string, nummer: number) => Promise<void>;
}) {
  const anzahl = (artikel.bilder ?? []).filter((b) => b.hochgeladen).length;
  const status = istStatus(artikel.status) ? STATUS_TEXT[artikel.status] : artikel.status;
  const e = artikel.erkennung;
  const treffer = artikel.treffer?.treffer ?? [];
  const haengt = !wertetAus && (artikel.status === 'fehler' || artikel.status === 'bereit');

  return (
    <li className={styles.verlaufZeile}>
      <div className={styles.verlaufKopf}>
        <span className={styles.verlaufNummer}>{artikel.nummer}</span>
        <span className={`${styles.marke} ${artikel.status === 'fehler' ? styles.markeFehler : ''}`}>
          {wertetAus ? 'wird ausgewertet …' : status}
        </span>
        <span className={styles.verlaufMeta}>
          {anzahl} Bild{anzahl === 1 ? '' : 'er'} · {uhrzeit(artikel.fertig_am ?? artikel.created_at)}
        </span>
      </div>

      {e && (
        <div className={styles.erkennung}>
          <p className={styles.erkennungTitel}>{e.titel}</p>
          <p className={styles.erkennungZeile}>
            {ZUSTAND_TEXT[e.zustand]}
            {e.modellnummer ? ` · Modellnr. ${e.modellnummer}` : ''}
            {e.sicherheit !== 'hoch' ? ` · Sicherheit ${e.sicherheit}` : ''}
          </p>
          {e.schaeden.length > 0 && (
            <p className={styles.schaeden}>
              {e.schaeden.length} Schaden/Schäden: {e.schaeden.join('; ')}
            </p>
          )}
          {!e.typenschildGefunden && (
            <p className={styles.warnZeile}>Kein lesbares Typenschild — Modellnummer fehlt.</p>
          )}
          {treffer.length > 0 && (
            <p className={styles.erkennungZeile}>
              Schon im Bestand: {treffer.slice(0, 3).map((t) => t.name || t.nummer || t.variationId).join(', ')}
            </p>
          )}
        </div>
      )}

      {artikel.erkennung_fehler && <p className={styles.verlaufFehler}>{artikel.erkennung_fehler}</p>}
      {artikel.fehler && <p className={styles.verlaufFehler}>{artikel.fehler}</p>}

      {haengt && (
        <button
          type="button"
          className={styles.erneut}
          onClick={() => void onErneutAuswerten(artikel.id, artikel.nummer)}
        >
          Noch einmal auswerten
        </button>
      )}
    </li>
  );
}

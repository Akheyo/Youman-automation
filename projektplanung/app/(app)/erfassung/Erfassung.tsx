'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './erfassung.module.css';
import Kamera from './Kamera';
import ZustandBestand from './ZustandBestand';
import { ZUSTAND_TEXT as PREIS_ZUSTAND_TEXT, type Zustand } from '@/lib/preis/regelwerk';
import {
  ERKANNTE_ROLLE_TEXT,
  STATUS_TEXT,
  artikelBereit,
  bereitHinweis,
  istStatus,
  validiereBild,
  zustandAbgleichen,
  type ErkannteRolle,
  type Packklasse,
} from '@/lib/erfassung/logic';
import { ZUSTAND_TEXT, type Erkennung } from '@/lib/erfassung/erkennung';
import { trefferText, type Treffer } from '@/lib/erfassung/treffer-kern';
import {
  MAX_RUNDEN,
  SCHRITTE,
  SCHRITT_TEXT,
  fortschritt,
  naechsterSchritt,
  type Arbeitsschritt,
  type Artikelstand,
} from '@/lib/erfassung/durchlauf';
import {
  arbeite,
  aussichtslos,
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
  zustand: Zustand | null;
  gravierende_schaeden: boolean | null;
  bestand: number | null;
  gewicht_kg: number | string | null;
  packklasse: Packklasse | null;
  preis: { ebay: number | null; webshop: number | null; hinweise?: string[] } | null;
  preis_am: string | null;
  preis_fehler: string | null;
  listing_am: string | null;
  listing_fehler: string | null;
  plenty_am: string | null;
  plenty_fehler: string | null;
  plenty_item_id: number | null;
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
  /** Welcher Schritt gerade läuft — „wird ausgewertet" allein sagt zu wenig. */
  const [schritt, setSchritt] = useState<string | null>(null);
  const [kameraOffen, setKameraOffen] = useState(false);
  const [zustand, setZustand] = useState<Zustand>('gebraucht');
  const [zustandBestaetigt, setZustandBestaetigt] = useState(false);
  const [gravierendeSchaeden, setGravierendeSchaeden] = useState(false);
  const [bestand, setBestand] = useState(1);
  // Gewicht bewusst als null und nicht als 0: „nicht gewogen" ist etwas
  // anderes als „wiegt nichts", und nur das erste darf zu einem Artikel ohne
  // Versandprofil führen statt zu einem mit falschem.
  const [gewichtKg, setGewichtKg] = useState<number | null>(null);
  const [packklasse, setPackklasse] = useState<Packklasse>('normal');

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
      // Leere Entwürfe gehören nicht in den Verlauf: Sie entstehen bei jedem
      // Öffnen der Seite und würden die Liste auf einem Handy zumüllen. Der
      // Artikel, an dem gerade gearbeitet wird, steht ohnehin oben im Kopf.
      setListe(artikel.filter((a) => a.status !== 'offen' || (a.bilder ?? []).some((b) => b.hochgeladen)));
      return artikel;
    } catch {
      // Die Liste ist Beiwerk — ein Fehler hier darf das Fotografieren nicht stören.
      return [];
    }
  }, []);

  /**
   * Der Durchlauf: Erkennung → Preis → Listing → Plenty, Schritt für Schritt.
   *
   * Die vier Schritte laufen als vier Aufrufe, weil jeder für sich an die
   * 60-Sekunden-Grenze der Serverless-Funktionen stößt. Der Fortschritt steht
   * nach jedem Schritt in der Datenbank — macht jemand die App zu, geht nichts
   * verloren, und der nächste Aufruf macht dort weiter.
   */
  const schrittAusfuehren = useCallback(
    async (id: string, nummer: number, schritt: Arbeitsschritt): Promise<boolean> => {
      const pfad = schritt === 'erkennen' ? 'erkennen' : schritt;
      try {
        const res = await fetch(`/api/erfassung/artikel/${id}/${pfad}`, { method: 'POST' });
        const daten = await alsJson(res);
        if (!res.ok) {
          setMeldung({
            art: 'fehler',
            text: `Artikel ${nummer}, ${SCHRITT_TEXT[schritt]}: ${String(daten.error ?? 'fehlgeschlagen')}`,
          });
          return false;
        }
        const hinweise = (daten.hinweise as string[]) ?? [];
        if (hinweise.length > 0) {
          setMeldung({ art: 'fehler', text: `Artikel ${nummer}: ${hinweise[0]}` });
        }
        return true;
      } catch (e) {
        setMeldung({
          art: 'fehler',
          text: `Artikel ${nummer}, ${SCHRITT_TEXT[schritt]}: ${e instanceof Error ? e.message : String(e)}`,
        });
        return false;
      }
    },
    [],
  );

  /**
   * Zieht alles nach, was noch nicht durch ist — ein Artikel nach dem anderen.
   *
   * Angestoßen wird das nach dem Abschicken und bei jedem Laden der Liste.
   * Damit läuft ein Artikel ohne weiteres Zutun durch: fotografieren, fertig,
   * und während schon der nächste auf dem Tisch liegt, wird der vorige
   * ausgewertet, bepreist, getextet und angelegt.
   *
   * Beim ersten Fehlschlag innerhalb eines Artikels wird abgebrochen und zum
   * nächsten gegangen. Nicht aus Bequemlichkeit: Ohne Preis wäre das Listing
   * eins für 0,00 €, und ein Artikel, der ohne Preis in Plenty landet, sieht
   * dort fertig aus.
   */
  const auswertenNachziehen = useCallback(
    async (artikelListe: ServerArtikel[]) => {
      if (auswertungLaeuft.current) return;
      const offen = artikelListe.filter(
        (a) => a.status !== 'offen' && !fortschritt(a).fertig && !versuchtRef.current.has(a.id),
      );
      if (offen.length === 0) return;

      auswertungLaeuft.current = true;
      try {
        for (const eintrag of offen) {
          // Einmal je Sitzung: Ein Artikel, der dreimal an derselben Stelle
          // scheitert, scheitert auch beim vierten Mal — und jede Runde
          // kostet Suchanfragen und Geld.
          versuchtRef.current.add(eintrag.id);
          setWertetAus(eintrag.id);

          let stand: Artikelstand = eintrag;
          try {
            for (let runde = 0; runde < MAX_RUNDEN; runde++) {
              const naechster = naechsterSchritt(stand);
              if (naechster === 'fertig') break;
              setSchritt(SCHRITT_TEXT[naechster]);
              const geklappt = await schrittAusfuehren(eintrag.id, eintrag.nummer, naechster);
              if (!geklappt) break;
              // Der Stand kommt aus der Datenbank, nicht aus einer Annahme:
              // Ein Schritt kann durchlaufen und trotzdem nichts gefunden
              // haben.
              const frisch = (await ladeListe()).find((a) => a.id === eintrag.id);
              if (!frisch) break;
              stand = frisch;
            }
          } finally {
            setWertetAus(null);
            setSchritt(null);
          }
        }
      } finally {
        auswertungLaeuft.current = false;
        await ladeListe();
      }
    },
    [ladeListe, schrittAusfuehren],
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
      // Von Hand angestoßen heißt: noch einmal ganz durch, egal wie oft es in
      // dieser Sitzung schon versucht wurde.
      versuchtRef.current.delete(id);
      try {
        let stand: Artikelstand = (await ladeListe()).find((a) => a.id === id) ?? {};
        for (let runde = 0; runde < MAX_RUNDEN; runde++) {
          const naechster = naechsterSchritt(stand);
          if (naechster === 'fertig') break;
          setSchritt(SCHRITT_TEXT[naechster]);
          if (!(await schrittAusfuehren(id, nummer, naechster))) break;
          const frisch = (await ladeListe()).find((a) => a.id === id);
          if (!frisch) break;
          stand = frisch;
        }
      } finally {
        setWertetAus(null);
        setSchritt(null);
        auswertungLaeuft.current = false;
        await ladeListe();
      }
    },
    [ladeListe, schrittAusfuehren],
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
    // Zustand bewusst wieder auf die Vorauswahl: Der naechste Artikel ist ein
    // anderer, und ein stehengebliebenes "defekt" waere teuer.
    setZustand('gebraucht');
    setZustandBestaetigt(false);
    setGravierendeSchaeden(false);
    setBestand(1);
    setGewichtKg(null);
    setPackklasse('normal');
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
        setZustand(a.zustand ?? 'gebraucht');
        setGravierendeSchaeden(Boolean(a.gravierende_schaeden));
        setBestand(a.bestand ?? 1);
        setGewichtKg(a.gewicht_kg == null ? null : Number(a.gewicht_kg));
        setPackklasse(a.packklasse ?? 'normal');
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

  /**
   * Ein Foto in die Reihe stellen. Wofür es taugt, entscheidet die Auswertung —
   * am Regal wird fotografiert, nicht sortiert.
   */
  const dateiUebernehmen = useCallback(
    async (datei: File) => {
      if (!artikel) return;
      const fehler = validiereBild({ contentType: datei.type, groesse: datei.size });
      if (fehler) {
        setMeldung({ art: 'fehler', text: `${datei.name}: ${fehler}` });
        return;
      }
      try {
        await einreihen(artikel.id, 'detail', datei);
      } catch (e) {
        setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
      }
    },
    [artikel],
  );

  const dateienUebernehmen = async (dateien: FileList | null) => {
    if (!dateien) return;
    for (const datei of Array.from(dateien)) await dateiUebernehmen(datei);
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
  const haengende = useMemo(() => fotos.filter((f) => f.status === 'fehler'), [fotos]);
  const fehlerhafte = haengende.length;
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
        body: JSON.stringify({ notiz, zustand, zustandBestaetigt, gravierendeSchaeden, bestand, gewichtKg, packklasse }),
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
        onClick={() => setKameraOffen(true)}
        disabled={!artikel || beschaeftigt}
      >
        <span className={styles.aufnehmenGross}>Kamera öffnen</span>
        <span className={styles.aufnehmenKlein}>
          Bleibt offen — so oft auslösen wie nötig, dann „Fertig“.
        </span>
      </button>

      <Kamera
        offen={kameraOffen}
        onFoto={(datei) => void dateiUebernehmen(datei)}
        onSchliessen={() => setKameraOffen(false)}
        onDialog={() => {
          setKameraOffen(false);
          // Ein kurzer Moment, sonst öffnet der Dialog hinter dem
          // verschwindenden Sucher.
          window.setTimeout(() => kameraRef.current?.click(), 50);
        }}
      />

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

      {haengende.length > 0 && (
        <section className={styles.haengt}>
          <h2>
            {haengende.length} Foto{haengende.length === 1 ? '' : 's'} nicht übertragen
          </h2>
          {haengende.map((f) => (
            <div key={f.schluessel} className={styles.haengtZeile}>
              {/* Der Grund im Klartext. Ohne ihn ist "hängt" eine Aussage ohne
                  Inhalt — und am Handy gibt es keinen Tooltip zum Nachsehen. */}
              <p className={styles.haengtGrund}>{f.meldung ?? 'Unbekannter Fehler.'}</p>
              <div className={styles.haengtKnoepfe}>
                {!aussichtslos(f.meldung) && f.queueId && (
                  <button type="button" onClick={() => void nochmal(f.queueId!)}>
                    Nochmal versuchen
                  </button>
                )}
                {f.queueId && (
                  <button type="button" onClick={() => void verwerfen(f.queueId!)}>
                    Foto verwerfen
                  </button>
                )}
              </div>
              {aussichtslos(f.meldung) && (
                <p className={styles.haengtHinweis}>
                  Dieses Foto gehört zu einem Artikel, den es nicht mehr gibt oder der schon abgeschickt ist. Ein
                  weiterer Anlauf ändert daran nichts — bitte verwerfen und, falls nötig, neu fotografieren.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <div className={styles.nebenwege}>
        <button type="button" onClick={() => galerieRef.current?.click()} disabled={!artikel || beschaeftigt}>
          Aus der Galerie
        </button>
        <button type="button" onClick={() => kameraRef.current?.click()} disabled={!artikel || beschaeftigt}>
          Einzelaufnahme
        </button>
      </div>

      <ZustandBestand
        zustand={zustand}
        gravierendeSchaeden={gravierendeSchaeden}
        bestand={bestand}
        gewichtKg={gewichtKg}
        packklasse={packklasse}
        gesperrt={!artikel || beschaeftigt}
        onZustand={(z) => {
          setZustand(z);
          // Ab jetzt ist es eine Aussage und nicht mehr die Vorauswahl.
          setZustandBestaetigt(true);
          if (z !== 'gebraucht') setGravierendeSchaeden(false);
        }}
        onGravierendeSchaeden={(w) => {
          setGravierendeSchaeden(w);
          setZustandBestaetigt(true);
        }}
        onBestand={setBestand}
        onGewicht={setGewichtKg}
        onPackklasse={setPackklasse}
      />

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
          {fehlerhafte > 0 && (
            <span className={styles.fussFehler}>{fehlerhafte} nicht übertragen — Grund steht oben</span>
          )}
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
              laufenderSchritt={wertetAus === a.id ? schritt : null}
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
  laufenderSchritt,
  onErneutAuswerten,
}: {
  artikel: ServerArtikel;
  wertetAus: boolean;
  laufenderSchritt: string | null;
  onErneutAuswerten: (id: string, nummer: number) => Promise<void>;
}) {
  const anzahl = (artikel.bilder ?? []).filter((b) => b.hochgeladen).length;
  const status = istStatus(artikel.status) ? STATUS_TEXT[artikel.status] : artikel.status;
  const e = artikel.erkennung;
  const treffer = artikel.treffer?.treffer ?? [];
  const stand = fortschritt(artikel);
  // Ein Artikel, der noch nicht durch ist und gerade nicht läuft, hängt —
  // egal an welchem der vier Schritte.
  const haengt = !wertetAus && artikel.status !== 'offen' && !stand.fertig;
  const preis = artikel.preis;
  // Was der Mensch am Regal angegeben hat, gegen das, was auf den Fotos war.
  const abgleich = zustandAbgleichen(artikel.zustand ?? 'gebraucht', e?.zustand, e?.schaeden ?? []);

  return (
    <li className={styles.verlaufZeile}>
      <div className={styles.verlaufKopf}>
        <span className={styles.verlaufNummer}>{artikel.nummer}</span>
        <span className={`${styles.marke} ${artikel.status === 'fehler' ? styles.markeFehler : ''}`}>
          {wertetAus ? `${laufenderSchritt ?? 'läuft'} …` : stand.fertig ? status : stand.text}
        </span>
        <span className={styles.verlaufMeta}>
          {anzahl} Bild{anzahl === 1 ? '' : 'er'}
          {artikel.zustand ? ` · ${PREIS_ZUSTAND_TEXT[artikel.zustand]}` : ''}
          {artikel.bestand && artikel.bestand > 1 ? ` · ${artikel.bestand}×` : ''}
          {' · '}
          {uhrzeit(artikel.fertig_am ?? artikel.created_at)}
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
          {abgleich.hinweis && <p className={styles.warnZeile}>{abgleich.hinweis}</p>}
          {treffer.length > 0 && (
            <p className={styles.erkennungZeile}>
              Schon im Bestand: {treffer.slice(0, 3).map(trefferText).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Was die Preisfindung ergeben hat. Ohne Preis steht ausdrücklich, dass
          keiner gefunden wurde — sonst sieht die Zeile aus wie eine, die
          niemand angefasst hat. */}
      {artikel.preis_am && (
        <p className={styles.erkennungZeile}>
          {preis?.ebay != null
            ? `eBay ${preis.ebay.toFixed(2)} € · Webshop ${preis.webshop?.toFixed(2) ?? '—'} €`
            : 'Kein Preis gefunden — es fehlen Vergleichsangebote.'}
        </p>
      )}
      {artikel.plenty_item_id && (
        <p className={styles.erkennungZeile}>
          In Plenty angelegt (ID {artikel.plenty_item_id}) — inaktiv, wartet auf Freigabe.
        </p>
      )}

      {artikel.erkennung_fehler && <p className={styles.verlaufFehler}>{artikel.erkennung_fehler}</p>}
      {artikel.preis_fehler && <p className={styles.verlaufFehler}>Preis: {artikel.preis_fehler}</p>}
      {artikel.listing_fehler && <p className={styles.verlaufFehler}>Listing: {artikel.listing_fehler}</p>}
      {artikel.plenty_fehler && <p className={styles.verlaufFehler}>Plenty: {artikel.plenty_fehler}</p>}
      {artikel.fehler && <p className={styles.verlaufFehler}>{artikel.fehler}</p>}

      {haengt && (
        <button
          type="button"
          className={styles.erneut}
          onClick={() => void onErneutAuswerten(artikel.id, artikel.nummer)}
        >
          {stand.erledigteSchritte === 0 ? 'Noch einmal auswerten' : `Weiter: ${SCHRITT_TEXT[stand.naechster]}`}
        </button>
      )}
    </li>
  );
}

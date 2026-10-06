'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './fotostudio.module.css';
import Kamera from '../erfassung/Kamera';
import { leseGewicht } from '../erfassung/ZustandBestand';
import Etiketten, { Barcode, eanText, type Druckauftrag } from './Etiketten';
import { ZUSTAND_TEXT, type Zustand } from '@/lib/preis/regelwerk';
import { validiereBild, type Packklasse } from '@/lib/erfassung/logic';
import { fehlerZeile } from '@/lib/erfassung/fehlertext';
import { ETIKETTFORMATE, etikettAnzahl, formatNachId } from '@/lib/fotostudio/etikett';
import {
  arbeite,
  aussichtslos,
  beobachte,
  einreihen,
  nochmal,
  vergissArtikel,
  verwerfeArtikel,
  verwerfen,
  vorschau,
  wiederAufnehmen,
  type Eintrag,
  type EintragStatus,
} from '@/lib/erfassung/warteschlange';

/**
 * Fotostudio — der Ersatz für die Make-Szenarien „Fotostudio PC 1/2".
 *
 * Ein Bildschirm, drei Schritte: Fotos machen (Kamera oder Dateien vom PC),
 * Zustand / Gewicht / Bestand angeben, anlegen. Danach steht der Artikel
 * inaktiv in Plenty, mit Bildern, EAN-Barcode und gebuchtem Bestand — und
 * aus dem Drucker kommt je Stück ein Etikett.
 */

export interface Stammwerte {
  ownerId: number;
  kategorieId: number;
  ebayPresetId: number | null;
  unitId: number;
  flagOne: number;
  flagTwo: number;
  warehouseId: number | null;
  eanBarcode: boolean;
  plentyBereit: boolean;
}

interface ServerBild {
  id: string;
  position: number;
  hochgeladen: boolean;
  url?: string | null;
}

interface ServerArtikel {
  id: string;
  nummer: number;
  status: string;
  ean: string | null;
  notiz: string | null;
  created_at: string;
  zustand: Zustand | null;
  gravierende_schaeden: boolean | null;
  bestand: number | null;
  gewicht_kg: number | string | null;
  packklasse: Packklasse | null;
  plenty_item_id: number | null;
  plenty_fehler: string | null;
  plenty: { offen?: string[] } | null;
  bilder: ServerBild[] | null;
}

interface Foto {
  schluessel: string;
  bild?: string;
  status: EintragStatus;
  meldung?: string;
  queueId?: string;
  serverId?: string;
}

interface Angaben {
  zustand: Zustand;
  gravierendeSchaeden: boolean;
  bestand: number;
  gewichtKg: number | null;
  packklasse: Packklasse;
  notiz: string;
}

interface Ergebnis {
  itemId: number | null;
  ean: string | null;
  nummer: number;
  zustand: Zustand;
  bestand: number;
  offen: string[];
  fehler: string | null;
  bild?: string;
}

const LEERE_ANGABEN: Angaben = {
  zustand: 'gebraucht',
  gravierendeSchaeden: false,
  bestand: 1,
  gewichtKg: null,
  packklasse: 'normal',
  notiz: '',
};

/** Farbton je Zustand — dazu immer der Text, nie die Farbe allein. */
const ZUSTAENDE: Array<{ wert: Zustand; titel: string; text: string; ton: 'gruen' | 'blau' | 'gold' | 'rot' }> = [
  { wert: 'neu_versiegelt', titel: 'Neu', text: 'versiegelt', ton: 'gruen' },
  { wert: 'neu', titel: 'Neu', text: 'offen, unbenutzt', ton: 'blau' },
  { wert: 'gebraucht', titel: 'Gebraucht', text: 'funktioniert', ton: 'gold' },
  { wert: 'defekt', titel: 'Defekt', text: 'funktioniert nicht', ton: 'rot' },
];

const SPEICHER_FORMAT = 'fotostudio.etikett';
const SPEICHER_AUTODRUCK = 'fotostudio.autodruck';

function lies(schluessel: string): string | null {
  try {
    return window.localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}
function merke(schluessel: string, wert: string): void {
  try {
    window.localStorage.setItem(schluessel, wert);
  } catch {
    /* ohne Speicher gilt die Einstellung nur bis zum Neuladen */
  }
}

async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unerwartete Antwort (HTTP ${res.status}).`);
  }
}

async function senden(url: string, koerper?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: koerper === undefined ? undefined : JSON.stringify(koerper),
  });
  const daten = await alsJson(res);
  if (!res.ok) throw new Error(String(daten.error ?? `HTTP ${res.status}`));
  return daten;
}

function uhrzeit(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function kg(wert: number | null): string {
  return wert == null ? 'ohne Gewicht' : `${String(wert).replace('.', ',')} kg`;
}

const STATUS_ANZEIGE: Record<string, { text: string; art: 'ok' | 'laeuft' | 'fehler' | 'offen' }> = {
  offen: { text: 'in Arbeit', art: 'offen' },
  anlage: { text: 'Bilder fehlen noch', art: 'laeuft' },
  in_plenty: { text: 'in Plenty', art: 'ok' },
  fehler: { text: 'Fehler', art: 'fehler' },
};

// ---------------------------------------------------------------------------
// Symbole (SVG, keine Emojis — die sehen auf jedem Gerät anders aus)
// ---------------------------------------------------------------------------

function Symbol({ name }: { name: 'kamera' | 'ordner' | 'drucker' | 'haken' | 'x' | 'nochmal' | 'pfeil' }) {
  const pfade: Record<typeof name, JSX.Element> = {
    kamera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </>
    ),
    ordner: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />,
    drucker: (
      <>
        <path d="M7 9V4h10v5" />
        <rect x="3" y="9" width="18" height="8" rx="1" />
        <path d="M7 14h10v6H7z" />
      </>
    ),
    haken: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    nochmal: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
    pfeil: <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {pfade[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------

export default function Fotostudio({ stammwerte }: { stammwerte: Stammwerte }) {
  const [artikel, setArtikel] = useState<{ id: string; nummer: number } | null>(null);
  const [serverBilder, setServerBilder] = useState<ServerBild[]>([]);
  const [reihe, setReihe] = useState<Eintrag[]>([]);
  const [angaben, setAngaben] = useState<Angaben>(LEERE_ANGABEN);
  const [liste, setListe] = useState<ServerArtikel[]>([]);
  const [meldung, setMeldung] = useState<{ art: 'hinweis' | 'fehler'; text: string } | null>(null);
  const [startet, setStartet] = useState(true);
  const [online, setOnline] = useState(true);
  const [kameraOffen, setKameraOffen] = useState(false);
  const [ziehen, setZiehen] = useState(false);
  const [fortschritt, setFortschritt] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [druck, setDruck] = useState<Druckauftrag | null>(null);
  const [formatId, setFormatId] = useState<string>('57x32');
  const [autodruck, setAutodruck] = useState(true);
  const [etikettAnzahlWahl, setEtikettAnzahlWahl] = useState(1);
  const [nachholen, setNachholen] = useState<string | null>(null);
  /** Welches Foto groß gezeigt wird; ohne Wahl das neueste. */
  const [auswahl, setAuswahl] = useState<string | null>(null);
  /** Der getippte Gewichtstext — getrennt von der Zahl, damit „2," stehen bleibt. */
  const [gewichtText, setGewichtText] = useState('');

  const dateiRef = useRef<HTMLInputElement>(null);
  const kameraDialogRef = useRef<HTMLInputElement>(null);
  const gestartetRef = useRef(false);

  const format = formatNachId(formatId);
  const druckFertig = useCallback(() => setDruck(null), []);
  const beschaeftigt = fortschritt !== null;

  // -------------------------------------------------------------------------
  // Einstellungen je Gerät
  // -------------------------------------------------------------------------

  useEffect(() => {
    setFormatId(formatNachId(lies(SPEICHER_FORMAT)).id);
    setAutodruck(lies(SPEICHER_AUTODRUCK) !== '0');
  }, []);

  // -------------------------------------------------------------------------
  // Laden und Sitzung
  // -------------------------------------------------------------------------

  const ladeListe = useCallback(async () => {
    try {
      const res = await fetch('/api/erfassung/artikel?quelle=fotostudio', { cache: 'no-store' });
      const daten = await alsJson(res);
      if (res.ok) setListe(((daten.artikel as ServerArtikel[]) ?? []).filter((a) => a.status !== 'offen'));
    } catch {
      /* Die Liste ist Beiwerk — der Fotoplatz arbeitet ohne sie weiter. */
    }
  }, []);

  const neuerArtikel = useCallback(async () => {
    const daten = await senden('/api/erfassung/artikel', { quelle: 'fotostudio' });
    const a = daten.artikel as { id: string; nummer: number };
    setArtikel({ id: a.id, nummer: a.nummer });
    setServerBilder([]);
    // Bewusst zurück auf die Vorauswahl: Der nächste Artikel ist ein anderer,
    // und ein stehengebliebenes „defekt" oder „12 Stück" wäre teuer.
    setAngaben(LEERE_ANGABEN);
  }, []);

  /** Setzt einen angefangenen Artikel fort, sonst entsteht ein neuer. */
  const starteSitzung = useCallback(async () => {
    setStartet(true);
    try {
      const res = await fetch('/api/erfassung/artikel?quelle=fotostudio&status=offen&mein=1', { cache: 'no-store' });
      const daten = await alsJson(res);
      if (!res.ok) throw new Error(String(daten.error ?? 'Laden fehlgeschlagen.'));
      const offen = ((daten.artikel as ServerArtikel[]) ?? [])[0];
      if (offen) {
        setArtikel({ id: offen.id, nummer: offen.nummer });
        setServerBilder((offen.bilder ?? []).filter((b) => b.hochgeladen).sort((a, b) => a.position - b.position));
        setAngaben({
          zustand: offen.zustand ?? 'gebraucht',
          gravierendeSchaeden: Boolean(offen.gravierende_schaeden),
          bestand: offen.bestand ?? 1,
          gewichtKg: offen.gewicht_kg == null ? null : Number(offen.gewicht_kg),
          packklasse: offen.packklasse ?? 'normal',
          notiz: offen.notiz ?? '',
        });
        if (offen.plenty_fehler) setMeldung({ art: 'fehler', text: fehlerZeile(offen.plenty_fehler) });
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
      void starteSitzung();
      void ladeListe();
    }
    return ab;
  }, [starteSitzung, ladeListe]);

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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  // -------------------------------------------------------------------------
  // Fotos
  // -------------------------------------------------------------------------

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

  const dateienUebernehmen = async (dateien: FileList | File[] | null) => {
    if (!dateien) return;
    // Nach Namen sortiert: Kamera-Software nummeriert fortlaufend, so landet
    // das erste Foto auch als Titelbild vorn.
    const sortiert = Array.from(dateien)
      .filter((d) => d.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(d.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
    for (const datei of sortiert) await dateiUebernehmen(datei);
  };

  const fotos: Foto[] = useMemo(() => {
    if (!artikel) return [];
    const ausServer: Foto[] = serverBilder.map((b) => ({
      schluessel: `s-${b.id}`,
      bild: b.url ?? undefined,
      status: 'oben' as EintragStatus,
      serverId: b.id,
    }));
    const ausReihe: Foto[] = reihe
      .filter((e) => e.artikelId === artikel.id)
      .map((e) => ({
        schluessel: `w-${e.id}`,
        bild: vorschau(e.id),
        status: e.status,
        meldung: e.meldung,
        queueId: e.id,
        serverId: e.bildId,
      }));
    return [...ausServer, ...ausReihe];
  }, [artikel, serverBilder, reihe]);

  const oben = fotos.filter((f) => f.status === 'oben').length;
  const unterwegs = fotos.filter((f) => f.status === 'wartet' || f.status === 'laedt').length;
  const haengend = fotos.filter((f) => f.status === 'fehler').length;

  const fotoEntfernen = async (foto: Foto) => {
    if (!artikel || beschaeftigt) return;
    try {
      // Auch ein reservierter, aber nie bestätigter Platz wird auf dem Server
      // entfernt — sonst bliebe eine leere Bildzeile am Artikel hängen.
      if (foto.serverId) {
        const res = await fetch(`/api/erfassung/artikel/${artikel.id}/bild`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bildId: foto.serverId }),
        });
        if (!res.ok) throw new Error(String((await alsJson(res)).error ?? 'Löschen fehlgeschlagen.'));
        setServerBilder((alt) => alt.filter((b) => b.id !== foto.serverId));
      }
      if (foto.queueId) await verwerfen(foto.queueId);
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const artikelVerwerfen = async () => {
    if (!artikel || beschaeftigt) return;
    if (fotos.length > 0 && !window.confirm(`Artikel #${artikel.nummer} mit ${fotos.length} Fotos verwerfen?`)) return;
    try {
      await verwerfeArtikel(artikel.id);
      await fetch(`/api/erfassung/artikel/${artikel.id}`, { method: 'DELETE' });
      setMeldung(null);
      await neuerArtikel();
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
    }
  };

  // -------------------------------------------------------------------------
  // Anlegen: Artikel → Bilder einzeln → Abschluss
  // -------------------------------------------------------------------------

  const drucken = useCallback(
    (e: { ean: string | null; itemId: number | null; nummer: number; zustand: Zustand }, anzahl: number) => {
      if (!e.ean) {
        setMeldung({ art: 'fehler', text: 'Keine EAN am Artikel — Etikett nicht druckbar.' });
        return;
      }
      setDruck({ ean: e.ean, itemId: e.itemId, nummer: e.nummer, zustand: ZUSTAND_TEXT[e.zustand] ?? e.zustand, anzahl });
    },
    [],
  );

  /**
   * Der ganze Weg nach Plenty. Wiederholbar: Jede Route prüft selbst, was schon
   * erledigt ist — ein zweiter Anlauf legt keinen zweiten Artikel an.
   */
  const nachPlenty = useCallback(
    async (ziel: { id: string; nummer: number }, a: Angaben): Promise<Ergebnis> => {
      setFortschritt('Artikel wird in Plenty angelegt …');
      const angelegt = await senden(`/api/fotostudio/artikel/${ziel.id}/anlegen`, {
        zustand: a.zustand,
        gravierendeSchaeden: a.gravierendeSchaeden,
        bestand: a.bestand,
        gewichtKg: a.gewichtKg,
        packklasse: a.packklasse,
        notiz: a.notiz,
      });
      const ean = (angelegt.ean as string | null) ?? null;
      const bildIds = (angelegt.bilder as string[]) ?? [];

      const bildFehler: string[] = [];
      for (let i = 0; i < bildIds.length; i += 1) {
        setFortschritt(`Foto ${i + 1} von ${bildIds.length} geht nach Plenty …`);
        try {
          await senden(`/api/fotostudio/artikel/${ziel.id}/bild`, { bildId: bildIds[i] });
        } catch (e) {
          bildFehler.push(`Foto ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      setFortschritt('Abschluss …');
      const abschluss = await senden(`/api/fotostudio/artikel/${ziel.id}/abschluss`);
      return {
        itemId: (abschluss.itemId as number) ?? null,
        ean,
        nummer: ziel.nummer,
        zustand: a.zustand,
        bestand: a.bestand,
        offen: [...((abschluss.offen as string[]) ?? []), ...bildFehler],
        fehler: (abschluss.fehler as string | null) ?? null,
      };
    },
    [],
  );

  const pruefHinweis = !stammwerte.plentyBereit
    ? 'PlentyONE ist nicht eingerichtet (Einstellungen).'
    : oben === 0
      ? 'Mindestens ein Foto machen.'
      : unterwegs > 0
        ? `${unterwegs === 1 ? 'Ein Foto lädt' : `${unterwegs} Fotos laden`} noch hoch …`
        : haengend > 0
          ? `${haengend === 1 ? 'Ein Foto hängt' : `${haengend} Fotos hängen`} — erneut senden oder entfernen.`
          : null;
  const kannAnlegen = Boolean(artikel) && !beschaeftigt && !startet && pruefHinweis === null;

  const anlegen = async () => {
    if (!artikel || !kannAnlegen) return;
    setMeldung(null);
    const ziel = artikel;
    const a = angaben;
    try {
      const e = await nachPlenty(ziel, a);
      setErgebnis({ ...e, bild: fotos.find((f) => f.bild)?.bild });
      setEtikettAnzahlWahl(etikettAnzahl(a.bestand));
      if (!e.fehler) {
        await vergissArtikel(ziel.id);
        if (autodruck) drucken(e, etikettAnzahl(a.bestand));
      }
    } catch (e) {
      // Der Artikel bleibt offen (oder steht mit Fehler in der Liste) —
      // nichts ist verloren, die Meldung sagt, was zu tun ist.
      setMeldung({ art: 'fehler', text: fehlerZeile(e instanceof Error ? e.message : String(e)) });
    } finally {
      setFortschritt(null);
      void ladeListe();
    }
  };

  const naechster = async () => {
    setErgebnis(null);
    setMeldung(null);
    try {
      await neuerArtikel();
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : String(e) });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Ein Artikel aus der Liste, bei dem Bilder fehlen: dort weitermachen. */
  const erneut = async (a: ServerArtikel) => {
    if (beschaeftigt) return;
    setNachholen(a.id);
    setMeldung(null);
    try {
      const e = await nachPlenty(
        { id: a.id, nummer: a.nummer },
        {
          zustand: a.zustand ?? 'gebraucht',
          gravierendeSchaeden: Boolean(a.gravierende_schaeden),
          bestand: a.bestand ?? 1,
          gewichtKg: a.gewicht_kg == null ? null : Number(a.gewicht_kg),
          packklasse: a.packklasse ?? 'normal',
          notiz: a.notiz ?? '',
        },
      );
      if (e.fehler) setMeldung({ art: 'fehler', text: `Artikel ${e.itemId ?? `#${a.nummer}`}: ${e.fehler}` });
      else setMeldung({ art: 'hinweis', text: `Artikel ${e.itemId} ist jetzt vollständig in Plenty.` });
    } catch (e) {
      setMeldung({ art: 'fehler', text: fehlerZeile(e instanceof Error ? e.message : String(e)) });
    } finally {
      setFortschritt(null);
      setNachholen(null);
      void ladeListe();
    }
  };


  // -------------------------------------------------------------------------
  // Darstellung
  // -------------------------------------------------------------------------

  const setze = <K extends keyof Angaben>(feld: K, wert: Angaben[K]) => setAngaben((alt) => ({ ...alt, [feld]: wert }));

  // Gewicht von außen gesetzt (neuer Artikel, fortgesetzter Artikel): Text nachziehen.
  useEffect(() => {
    setGewichtText((bisher) =>
      leseGewicht(bisher) === angaben.gewichtKg ? bisher : angaben.gewichtKg == null ? '' : String(angaben.gewichtKg).replace('.', ','),
    );
  }, [angaben.gewichtKg]);

  const tippeGewicht = (roh: string) => {
    const sauber = roh.replace(/[^0-9.,]/g, '').slice(0, 7);
    setGewichtText(sauber);
    setze('gewichtKg', leseGewicht(sauber));
  };

  const setzeBestand = (n: number) => {
    if (!Number.isFinite(n)) return;
    setze('bestand', Math.min(Math.max(Math.round(n), 1), 9999));
  };

  const gross = fotos.find((f) => f.schluessel === auswahl) ?? fotos[fotos.length - 1];
  const grossIndex = gross ? fotos.indexOf(gross) : -1;

  const etikettEinstellungen = (
    <div className={styles.einstellungen}>
      <label className={styles.einstellungZeile}>
        <span>Etikett</span>
        <select
          className={styles.auswahl}
          value={format.id}
          onChange={(e) => {
            setFormatId(e.target.value);
            merke(SPEICHER_FORMAT, e.target.value);
          }}
        >
          {ETIKETTFORMATE.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.schalterZeile}>
        <input
          type="checkbox"
          role="switch"
          checked={autodruck}
          onChange={(e) => {
            setAutodruck(e.target.checked);
            merke(SPEICHER_AUTODRUCK, e.target.checked ? '1' : '0');
          }}
        />
        <span>Automatisch drucken</span>
      </label>
    </div>
  );

  // ---- Bühne: links, dunkel — die Fotos stehen im Mittelpunkt -------------
  const buehne = (
    <section
      className={`${styles.buehne} ${ziehen ? styles.buehneZiehen : ''}`}
      aria-label="Fotos"
      onDragOver={(e) => {
        if (ergebnis) return;
        e.preventDefault();
        setZiehen(true);
      }}
      onDragLeave={() => setZiehen(false)}
      onDrop={(e) => {
        e.preventDefault();
        setZiehen(false);
        if (!ergebnis) void dateienUebernehmen(e.dataTransfer.files);
      }}
    >
      <header className={styles.buehneKopf}>
        <div>
          <p className={styles.marke}>Fotostudio</p>
          <h1 className={styles.nummer}>{artikel ? `#${artikel.nummer}` : '…'}</h1>
        </div>
        <div className={styles.buehneKopfRechts}>
          <span className={`${styles.pille} ${online ? styles.pilleOnline : styles.pilleOffline}`}>
            <span className={styles.pilleLicht} aria-hidden />
            {online ? 'Online' : 'Offline'}
          </span>
          {artikel && !ergebnis && (
            <button type="button" className={styles.geist} onClick={artikelVerwerfen} disabled={beschaeftigt || startet}>
              Verwerfen
            </button>
          )}
        </div>
      </header>

      {ergebnis ? (
        <div className={styles.fertigBild}>
          {ergebnis.bild ? <img src={ergebnis.bild} alt="Titelbild des angelegten Artikels" /> : <div className={styles.leerFlaeche} />}
          <span className={`${styles.fertigStempel} ${ergebnis.fehler ? styles.fertigStempelWarn : ''}`}>
            <Symbol name={ergebnis.fehler ? 'x' : 'haken'} />
            {ergebnis.fehler ? 'Unvollständig' : 'In Plenty'}
          </span>
        </div>
      ) : fotos.length === 0 ? (
        <button
          type="button"
          className={styles.leer}
          onClick={() => setKameraOffen(true)}
          disabled={!artikel || beschaeftigt}
        >
          <span className={styles.leerSymbol}>
            <Symbol name="kamera" />
          </span>
          <span className={styles.leerTitel}>Erstes Foto aufnehmen</span>
          <span className={styles.leerText}>oder Fotos vom PC hierher ziehen</span>
        </button>
      ) : (
        <>
          <div className={styles.gross}>
            {gross?.bild ? <img src={gross.bild} alt={`Foto ${grossIndex + 1}`} /> : <div className={styles.leerFlaeche} />}
            <span className={styles.grossZaehler}>
              {grossIndex + 1} / {fotos.length}
            </span>
            {grossIndex === 0 && <span className={styles.grossTitel}>Titelbild</span>}
          </div>
          <ul className={styles.streifen} aria-label="Alle Fotos">
            {fotos.map((f, i) => (
              <li key={f.schluessel} className={`${styles.mini} ${f === gross ? styles.miniAktiv : ''}`}>
                <button type="button" className={styles.miniKnopf} onClick={() => setAuswahl(f.schluessel)} aria-label={`Foto ${i + 1} groß zeigen`} aria-pressed={f === gross}>
                  {f.bild ? <img src={f.bild} alt="" /> : <span className={styles.leerFlaeche} />}
                </button>
                <span
                  className={`${styles.miniStatus} ${f.status === 'oben' ? styles.miniOk : f.status === 'fehler' ? styles.miniFehler : styles.miniLaeuft}`}
                  title={f.status === 'oben' ? 'hochgeladen' : f.status === 'fehler' ? f.meldung : 'lädt hoch'}
                  aria-label={f.status === 'oben' ? 'hochgeladen' : f.status === 'fehler' ? 'Upload hängt' : 'lädt hoch'}
                >
                  {f.status === 'oben' ? <Symbol name="haken" /> : f.status === 'fehler' ? '!' : ''}
                </span>
                <button type="button" className={styles.miniWeg} onClick={() => void fotoEntfernen(f)} aria-label={`Foto ${i + 1} entfernen`} disabled={beschaeftigt}>
                  <Symbol name="x" />
                </button>
                {f.status === 'fehler' && f.queueId && !aussichtslos(f.meldung) && (
                  <button type="button" className={styles.miniNochmal} onClick={() => void nochmal(f.queueId!)} aria-label={`Foto ${i + 1} erneut senden`}>
                    <Symbol name="nochmal" />
                  </button>
                )}
              </li>
            ))}
            <li>
              <button type="button" className={styles.miniPlus} onClick={() => setKameraOffen(true)} disabled={!artikel || beschaeftigt} aria-label="Weiteres Foto aufnehmen">
                +
              </button>
            </li>
          </ul>
        </>
      )}

      {!ergebnis && (
        <div className={styles.buehneFuss}>
          <button type="button" className={styles.kameraKnopf} onClick={() => setKameraOffen(true)} disabled={!artikel || beschaeftigt}>
            <Symbol name="kamera" />
            Kamera
          </button>
          <button type="button" className={styles.dateiKnopf} onClick={() => dateiRef.current?.click()} disabled={!artikel || beschaeftigt}>
            <Symbol name="ordner" />
            Dateien
          </button>
          <span className={styles.buehneInfo} aria-live="polite">
            {oben} oben{unterwegs > 0 ? ` · ${unterwegs} lädt` : ''}
            {haengend > 0 ? ` · ${haengend} hängt` : ''}
          </span>
        </div>
      )}

      <input ref={dateiRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void dateienUebernehmen(e.target.files); e.target.value = ''; }} />
      <input ref={kameraDialogRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void dateienUebernehmen(e.target.files); e.target.value = ''; }} />
    </section>
  );

  // ---- Bedienfeld: rechts — Zustand, Bestand, Gewicht, Anlegen ------------
  const bedienfeld = (
    <section className={styles.feld} aria-label="Angaben zum Artikel">
      <div className={styles.block}>
        <h2 className={styles.blockTitel}>
          <span className={styles.schritt}>1</span>Zustand
        </h2>
        <div className={styles.zustaende} role="group" aria-label="Zustand">
          {ZUSTAENDE.map((z) => (
            <button
              key={z.wert}
              type="button"
              className={`${styles.zustand} ${styles[`ton_${z.ton}`]} ${angaben.zustand === z.wert ? styles.zustandAktiv : ''}`}
              onClick={() => setze('zustand', z.wert)}
              aria-pressed={angaben.zustand === z.wert}
              disabled={beschaeftigt}
            >
              <span className={styles.zustandPunkt} aria-hidden />
              <span className={styles.zustandName}>{z.titel}</span>
              <span className={styles.zustandText}>{z.text}</span>
            </button>
          ))}
        </div>
        {angaben.zustand === 'gebraucht' && (
          <button
            type="button"
            className={`${styles.chipSchalter} ${angaben.gravierendeSchaeden ? styles.chipSchalterAn : ''}`}
            onClick={() => setze('gravierendeSchaeden', !angaben.gravierendeSchaeden)}
            aria-pressed={angaben.gravierendeSchaeden}
            disabled={beschaeftigt}
          >
            <span className={styles.chipHaken} aria-hidden>
              {angaben.gravierendeSchaeden && <Symbol name="haken" />}
            </span>
            Gravierende Schäden
          </button>
        )}
      </div>

      <div className={styles.zweier}>
        <div className={styles.block}>
          <h2 className={styles.blockTitel}>
            <span className={styles.schritt}>2</span>Bestand
          </h2>
          <div className={styles.stepper}>
            <button type="button" onClick={() => setzeBestand(angaben.bestand - 1)} disabled={beschaeftigt || angaben.bestand <= 1} aria-label="Ein Stück weniger">
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={angaben.bestand}
              onChange={(e) => setzeBestand(Number(e.target.value.replace(/\D/g, '') || '1'))}
              disabled={beschaeftigt}
              aria-label="Bestand in Stück"
            />
            <button type="button" onClick={() => setzeBestand(angaben.bestand + 1)} disabled={beschaeftigt} aria-label="Ein Stück mehr">
              +
            </button>
          </div>
          <div className={styles.schnell}>
            {[1, 2, 5, 10].map((n) => (
              <button key={n} type="button" className={angaben.bestand === n ? styles.schnellAktiv : ''} onClick={() => setzeBestand(n)} disabled={beschaeftigt} aria-pressed={angaben.bestand === n}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.block}>
          <h2 className={styles.blockTitel}>
            <label htmlFor="gewicht" className={styles.blockTitelLabel}>
              <span className={styles.schritt}>3</span>Gewicht
            </label>
          </h2>
          <div className={`${styles.gewicht} ${angaben.gewichtKg == null ? styles.gewichtLeer : ''}`}>
            <input
              id="gewicht"
              type="text"
              inputMode="decimal"
              placeholder="0,0"
              value={gewichtText}
              onChange={(e) => tippeGewicht(e.target.value)}
              disabled={beschaeftigt}
            />
            <span>kg</span>
          </div>
          <p className={styles.blockHinweis}>
            {angaben.gewichtKg != null && angaben.gewichtKg > 30 ? 'Über 30 kg: nur Spedition.' : 'Ein Stück, verpackt.'}
          </p>
        </div>
      </div>

      <details className={styles.mehr}>
        <summary>Notiz, Etikett und Stammwerte</summary>
        <label className={styles.notizLabel} htmlFor="notiz">
          Notiz (intern)
        </label>
        <textarea id="notiz" className={styles.notiz} rows={2} value={angaben.notiz} onChange={(e) => setze('notiz', e.target.value)} disabled={beschaeftigt} placeholder="z. B. Netzteil fehlt" />
        {etikettEinstellungen}
        <dl className={styles.stammwerte}>
          <div><dt>Kategorie</dt><dd>{stammwerte.kategorieId}</dd></div>
          <div><dt>Besitzer</dt><dd>{stammwerte.ownerId}</dd></div>
          <div><dt>eBay-Vorlage</dt><dd>{stammwerte.ebayPresetId ?? '—'}</dd></div>
          <div><dt>Einheit</dt><dd>{stammwerte.unitId}</dd></div>
          <div><dt>Flag 1 / 2</dt><dd>{stammwerte.flagOne} / {stammwerte.flagTwo}</dd></div>
          <div><dt>Lager</dt><dd>{stammwerte.warehouseId ?? 'fehlt'}</dd></div>
          <div><dt>Barcode</dt><dd>{stammwerte.eanBarcode ? 'EAN13_2' : 'fehlt'}</dd></div>
        </dl>
      </details>

      <div className={styles.aktion}>
        <dl className={styles.bilanz}>
          <div><dt>Fotos</dt><dd>{oben}</dd></div>
          <div><dt>Stück</dt><dd>{angaben.bestand}</dd></div>
          <div><dt>Gewicht</dt><dd>{angaben.gewichtKg == null ? '—' : `${String(angaben.gewichtKg).replace('.', ',')} kg`}</dd></div>
          <div><dt>Etiketten</dt><dd>{autodruck ? etikettAnzahl(angaben.bestand) : 'aus'}</dd></div>
        </dl>
        <button type="button" className={styles.anlegen} onClick={anlegen} disabled={!kannAnlegen} aria-busy={beschaeftigt}>
          {beschaeftigt ? <span className={styles.kreisel} aria-hidden /> : <Symbol name="haken" />}
          {beschaeftigt ? 'Wird angelegt …' : 'In Plenty anlegen'}
        </button>
        <p className={`${styles.aktionText} ${pruefHinweis && !beschaeftigt ? styles.aktionTextWarn : ''}`} aria-live="polite">
          {fortschritt ?? pruefHinweis ?? (autodruck ? 'Danach druckt je Stück ein Etikett.' : 'Bereit.')}
        </p>
      </div>
    </section>
  );

  // ---- Ergebnis: Artikel-ID, Etikett-Vorschau, Druck ----------------------
  const ergebnisfeld = ergebnis && (
    <section className={styles.feld} aria-live="polite">
      <p className={styles.ergebnisMarke}>{ergebnis.fehler ? 'Angelegt, aber unvollständig' : 'Angelegt · inaktiv'}</p>
      <p className={styles.ergebnisId}>{ergebnis.itemId ?? '—'}</p>
      <p className={styles.ergebnisZeile}>
        {ZUSTAND_TEXT[ergebnis.zustand]} · {ergebnis.bestand} Stück
      </p>

      {ergebnis.ean && (
        <div className={styles.etikettVorschau} aria-label="Etikett-Vorschau">
          <div className={styles.etikettKopf}>
            <strong>Art. {ergebnis.itemId ?? `#${ergebnis.nummer}`}</strong>
            <span>{ZUSTAND_TEXT[ergebnis.zustand]}</span>
          </div>
          <Barcode ean={ergebnis.ean} hoeheMm={14} />
          <p className={styles.etikettEan}>{eanText(ergebnis.ean)}</p>
        </div>
      )}

      {ergebnis.fehler && <p className={`${styles.meldung} ${styles.meldungFehler}`}>{ergebnis.fehler}</p>}
      {ergebnis.offen.length > 0 && (
        <ul className={styles.offen}>
          {ergebnis.offen.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}

      <div className={styles.druckZeile}>
        <div className={styles.stepper}>
          <button type="button" onClick={() => setEtikettAnzahlWahl((n) => Math.max(1, n - 1))} aria-label="Ein Etikett weniger">
            −
          </button>
          <output aria-live="polite">{etikettAnzahlWahl}</output>
          <button type="button" onClick={() => setEtikettAnzahlWahl((n) => Math.min(200, n + 1))} aria-label="Ein Etikett mehr">
            +
          </button>
        </div>
        <button type="button" className={styles.drucken} onClick={() => drucken(ergebnis, etikettAnzahlWahl)} disabled={!ergebnis.ean}>
          <Symbol name="drucker" />
          Drucken
        </button>
      </div>
      {etikettEinstellungen}

      <button type="button" className={styles.anlegen} onClick={naechster}>
        Nächster Artikel
        <Symbol name="pfeil" />
      </button>
    </section>
  );

  return (
    <div className={styles.seite}>
      {meldung && (
        <p className={`${styles.meldung} ${meldung.art === 'fehler' ? styles.meldungFehler : styles.meldungHinweis}`} role={meldung.art === 'fehler' ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}

      <div className={styles.arbeitsplatz}>
        {buehne}
        {ergebnis ? ergebnisfeld : bedienfeld}
      </div>

      {liste.length > 0 && (
        <section className={styles.verlauf} aria-labelledby="verlauf-titel">
          <h2 id="verlauf-titel" className={styles.verlaufTitel}>
            Zuletzt im Fotostudio
          </h2>
          <ul className={styles.zeilen}>
            {liste.map((a) => {
              const s = STATUS_ANZEIGE[a.status] ?? { text: a.status, art: 'offen' as const };
              const titelbild = (a.bilder ?? []).filter((b) => b.hochgeladen).sort((x, y) => x.position - y.position)[0];
              const gewicht = a.gewicht_kg == null ? null : Number(a.gewicht_kg);
              return (
                <li key={a.id} className={styles.zeile}>
                  {titelbild?.url ? <img src={titelbild.url} alt="" className={styles.zeileBild} /> : <span className={styles.zeileBild} />}
                  <div className={styles.zeileText}>
                    <p className={styles.zeileTitel}>
                      {a.plenty_item_id ?? `#${a.nummer}`}
                      <span className={`${styles.status} ${styles[`status_${s.art}`]}`}>{s.text}</span>
                    </p>
                    <p className={styles.zeileMeta}>
                      {ZUSTAND_TEXT[a.zustand ?? 'gebraucht']} · {kg(gewicht)} · {a.bestand ?? 1} Stk · {uhrzeit(a.created_at)}
                    </p>
                    {a.plenty_fehler && <p className={styles.zeileFehler}>{fehlerZeile(a.plenty_fehler)}</p>}
                  </div>
                  <div className={styles.zeileAktionen}>
                    {(a.status === 'anlage' || a.status === 'fehler') && (
                      <button type="button" className={styles.klein} onClick={() => void erneut(a)} disabled={beschaeftigt}>
                        <Symbol name="nochmal" />
                        {nachholen === a.id ? 'läuft …' : 'Fortsetzen'}
                      </button>
                    )}
                    {a.ean && (
                      <button
                        type="button"
                        className={styles.klein}
                        onClick={() => drucken({ ean: a.ean, itemId: a.plenty_item_id, nummer: a.nummer, zustand: a.zustand ?? 'gebraucht' }, etikettAnzahl(a.bestand))}
                        aria-label={`Etiketten für ${a.plenty_item_id ?? a.nummer} drucken`}
                      >
                        <Symbol name="drucker" />
                        {etikettAnzahl(a.bestand)}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Kamera
        offen={kameraOffen}
        onFoto={(d) => void dateiUebernehmen(d)}
        onSchliessen={() => setKameraOffen(false)}
        onDialog={() => {
          setKameraOffen(false);
          kameraDialogRef.current?.click();
        }}
      />
      <Etiketten auftrag={druck} format={format} onFertig={druckFertig} />
    </div>
  );
}

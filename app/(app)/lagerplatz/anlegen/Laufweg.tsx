'use client';

import { useState } from 'react';
import styles from '../lagerplatz.module.css';

interface Lager { id: number; name: string }
interface Aenderung { id: number; name: string; parentId: number; dimensionId: number; alt: number; neu: number }
interface Dublette { parentId: number; dimensionId: number; schluessel: string; namen: string[]; ids: number[] }
interface Ergebnis {
  ok: boolean; probelauf: boolean; error: string | null;
  knoten: number; gruppen: number; aenderungen: Aenderung[];
  geschrieben: number; fehler: number; offen: number; schreiblimit: boolean;
  dubletten: Dublette[]; meldungen: string[];
}

/** Lädt einen Text als CSV-Datei herunter (BOM, damit Excel Umlaute zeigt). */
function ladeHerunter(dateiname: string, inhalt: string) {
  const blob = new Blob(['﻿' + inhalt], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Ordnet den Kommissionier-Laufweg: PlentyONE läuft die Plätze in der
 * Reihenfolge der Struktur-Positionen ab. Neue Knoten landen beim Anlegen
 * hinten statt einsortiert — in Burlo stand deshalb F16, F17, F18, F01, F02.
 */
export default function Laufweg() {
  const [lager, setLager] = useState<Lager[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [freigabe, setFreigabe] = useState('');
  const [wartet, setWartet] = useState<number | null>(null);

  const erlaubt = freigabe.trim().toUpperCase() === 'ORDNEN' && Boolean(warehouseId);

  async function ladeLager() {
    setLaeuft('lager'); setFehler(null);
    try {
      const res = await fetch('/api/lagerplatz/lagerorte');
      const d = (await res.json()) as { lager?: Lager[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? 'Lager nicht ladbar.');
      setLager(d.lager ?? []);
    } catch (e) { setFehler((e as Error).message); } finally { setLaeuft(null); }
  }

  /**
   * Startet den Lauf und wiederholt ihn, solange noch Knoten offen sind.
   * Bremst PlentyONE das Schreiben aus, wird eine Minute gewartet.
   */
  async function starte(probelauf: boolean) {
    if (!warehouseId) return;
    setLaeuft(probelauf ? 'probe' : 'ordnen'); setFehler(null); setErgebnis(null);

    let summe: Ergebnis | null = null;
    try {
      for (let runde = 0; runde < 50; runde++) {
        const res = await fetch('/api/lagerplatz/laufweg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ warehouseId, probelauf, maxSchreiben: 500 }),
        });
        const d = (await res.json()) as Ergebnis;
        if (d.error) throw new Error(d.error);

        summe = summe
          ? { ...d, geschrieben: summe.geschrieben + d.geschrieben, fehler: summe.fehler + d.fehler }
          : d;
        setErgebnis(summe);

        if (probelauf || !d.offen) break;
        if (d.schreiblimit) {
          for (let rest = 60; rest > 0; rest--) {
            setWartet(rest);
            await new Promise((f) => setTimeout(f, 1000));
          }
          setWartet(null);
        } else if (d.geschrieben === 0) {
          break;
        }
      }
      if (!probelauf) setFreigabe('');
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setWartet(null); setLaeuft(null);
    }
  }

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>Laufweg ordnen</h2></div>
        <p className={styles.checkHint}>
          PlentyONE läuft die Lagerplätze in der Reihenfolge der Struktur-Positionen ab (Halle, Regal, Ebene,
          Feld). Neu angelegte Knoten landen hinten statt einsortiert — dann steht in einem Regal
          F16, F17, F18, F01, F02 und der Kommissionierer läuft zweimal denselben Gang.
          Hier werden die Positionen je Elternknoten neu durchnummeriert.
          <strong> Geschrieben wird nur die Position: kein Bestand bewegt sich, nichts wird umbenannt.</strong>
        </p>

        {fehler && <p className={`${styles.notice} ${styles.noticeErr}`}>{fehler}</p>}

        <div className={styles.controls}>
          <button type="button" className={styles.secondary} onClick={ladeLager} disabled={!!laeuft}>
            {laeuft === 'lager' ? 'lädt …' : 'Lager laden'}
          </button>
          {lager.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="lw-lager">Lager</label>
              <select id="lw-lager" className={styles.select} value={warehouseId ?? ''}
                onChange={(e) => setWarehouseId(Number(e.target.value) || null)}>
                <option value="">— bitte wählen —</option>
                {lager.map((l) => <option key={l.id} value={l.id}>{l.name} (ID {l.id})</option>)}
              </select>
            </div>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => starte(true)}
              disabled={!!laeuft || !warehouseId}>
              {laeuft === 'probe' ? 'prüft …' : 'Probelauf'}
            </button>
          </div>
        </div>

        {ergebnis && (
          <>
            <ul className={styles.checkHint}>
              {ergebnis.meldungen.map((m, i) => <li key={i}>{m}</li>)}
            </ul>

            {ergebnis.aenderungen.length > 0 && (
              <div className={styles.controls}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="lw-freigabe">Zum Bestätigen „ORDNEN" eintippen</label>
                  <input id="lw-freigabe" className={styles.input} value={freigabe} placeholder="ORDNEN"
                    onChange={(e) => setFreigabe(e.target.value)} disabled={!!laeuft} />
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} onClick={() => starte(false)}
                    disabled={!!laeuft || !erlaubt}>
                    {laeuft === 'ordnen' ? 'ordnet …' : `${ergebnis.aenderungen.length} Knoten ordnen`}
                  </button>
                  <button type="button" className={styles.secondary}
                    onClick={() => ladeHerunter('laufweg-aenderungen.csv',
                      ['Knoten-ID;Name;Elternknoten;Spalte;Position alt;Position neu',
                        ...ergebnis.aenderungen.map((a) => `${a.id};${a.name};${a.parentId};${a.dimensionId};${a.alt};${a.neu}`)].join('\n'))}>
                    Änderungen als CSV
                  </button>
                </div>
              </div>
            )}

            {wartet !== null && (
              <p className={styles.progress}>
                PlentyONE bremst Schreibzugriffe — weiter in {wartet} s. Fenster offen lassen.
              </p>
            )}

            {!ergebnis.probelauf && (
              <p className={styles.progress}>
                {ergebnis.geschrieben.toLocaleString('de-DE')} Knoten geordnet
                {ergebnis.fehler ? ` · ${ergebnis.fehler} Fehler` : ''}
                {ergebnis.offen ? ` · ${ergebnis.offen} offen` : ''}
              </p>
            )}

            {ergebnis.dubletten.length > 0 && (
              <>
                <p className={`${styles.notice} ${styles.noticeWarn}`}>
                  {ergebnis.dubletten.length} Felder gibt es doppelt — dasselbe Fach in zwei Schreibweisen
                  (etwa F1 und F01). Darunter hängen jeweils eigene Lagerorte mit echtem Bestand.
                  <strong> Zusammengeführt wird hier nichts</strong> — das bewegt Ware und will einzeln
                  entschieden werden.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary}
                    onClick={() => ladeHerunter('doppelte-felder.csv',
                      ['Vergleichsname;Namen;Knoten-IDs;Elternknoten;Spalte',
                        ...ergebnis.dubletten.map((d) => `${d.schluessel};${d.namen.join(' | ')};${d.ids.join(' | ')};${d.parentId};${d.dimensionId}`)].join('\n'))}>
                    Doppelte Felder als CSV
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import styles from '../lagerplatz.module.css';
import { codesAusTabelle } from '@/lib/lagerplatz/laeufe';

interface Lager { id: number; name: string }
interface Zeile {
  code: string;
  status: 'vorhanden' | 'geplant' | 'angelegt' | 'uebersprungen' | 'fehler';
  id: number | null;
  neueKnoten: number;
  hinweis: string | null;
}
interface Antwort {
  ok: boolean; probelauf: boolean; error: string | null;
  bestehende: number; vorhanden: number; geplant: number; angelegt: number;
  uebersprungen: number; fehler: number; neueKnoten: number;
  offen: number; naechsterIndex: number; gesamtZeilen: number;
  schreiblimit: boolean;
  zeilen: Zeile[]; diagnose: string[];
}
/** Zusammengezogenes Ergebnis über alle Teilaufrufe eines Laufs. */
interface Ergebnis {
  probelauf: boolean;
  bestehende: number;
  vorhanden: number; geplant: number; angelegt: number;
  uebersprungen: number; fehler: number; neueKnoten: number;
  offen: number;
  zeilen: Zeile[];
  diagnose: string[];
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
 * Liest eine Antwort als JSON — und gibt eine lesbare Meldung, wenn stattdessen
 * eine Fehlerseite kommt (bei einem Timeout schickt Vercel HTML, kein JSON).
 */
async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const anfang = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(
      res.status === 504 || /timed? ?out|FUNCTION_INVOCATION_TIMEOUT/i.test(text)
        ? 'Zeitüberschreitung — der Lauf wird in kleineren Blöcken fortgesetzt.'
        : `Unerwartete Antwort (HTTP ${res.status}): ${anfang || 'leer'}`,
    );
  }
}

const LEER: Ergebnis = {
  probelauf: true, bestehende: 0, vorhanden: 0, geplant: 0, angelegt: 0,
  uebersprungen: 0, fehler: 0, neueKnoten: 0, offen: 0, zeilen: [], diagnose: [],
};

export default function Anlegen({ plentyReady }: { plentyReady: boolean }) {
  const [lager, setLager] = useState<Lager[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [lagerInfo, setLagerInfo] = useState<string | null>(null);
  const [tabelle, setTabelle] = useState('');
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [freigabe, setFreigabe] = useState('');
  const [wartet, setWartet] = useState<number | null>(null);
  const [unbekannt, setUnbekannt] = useState<string[]>([]);
  const abbrechen = useRef(false);

  /** Die Tabelle wird schon beim Tippen aufgelöst — dieselbe Logik wie im Server. */
  const gelesen = useMemo(() => codesAusTabelle(tabelle), [tabelle]);

  const anlegenErlaubt =
    freigabe.trim().toUpperCase() === 'ANLEGEN' && Boolean(warehouseId) && gelesen.codes.length > 0;

  async function ladeLager() {
    setLaeuft('lager'); setFehler(null);
    try {
      const res = await fetch('/api/lagerplatz/lagerorte');
      const d = await alsJson(res);
      if (!res.ok) throw new Error(String(d.error ?? 'Lager nicht ladbar.'));
      setLager((d.lager as Lager[]) ?? []);
    } catch (e) { setFehler((e as Error).message); } finally { setLaeuft(null); }
  }

  async function pruefeLagerorte(id: number) {
    setLaeuft('orte'); setFehler(null); setLagerInfo(null);
    try {
      const res = await fetch(`/api/lagerplatz/lagerorte?warehouseId=${id}`);
      const d = await alsJson(res);
      if (!res.ok) throw new Error(String(d.error ?? 'Lagerorte nicht ladbar.'));
      setLagerInfo(`${d.gesamt} Lagerorte vorhanden, davon ${d.zuordenbar} zuordenbar` +
        (d.ohneCode ? ` · ${d.ohneCode} mit unbekanntem Namensschema` : '') +
        (d.doppelt ? ` · ${d.doppelt} doppelte Namen` : ''));
      setUnbekannt(((d.beispieleOhneCode as Array<{ id: number; name: string }>) ?? []).map((o) => `${o.name} (ID ${o.id})`));
    } catch (e) { setFehler((e as Error).message); } finally { setLaeuft(null); }
  }

  /**
   * Arbeitet die ganze Liste ab — in so vielen Teilaufrufen, wie nötig sind.
   * Jeder Aufruf hat ein eigenes Zeitbudget; danach meldet der Server, ab
   * welcher Zeile es weitergeht. Genau das macht den Unterschied zur Maske:
   * Man startet einmal und schaut zu.
   */
  async function starte(probelauf: boolean) {
    if (!warehouseId) return;
    abbrechen.current = false;
    setLaeuft(probelauf ? 'probe' : 'anlegen');
    setFehler(null);
    setErgebnis(null);
    setFortschritt({ fertig: 0, gesamt: gelesen.codes.length });

    const summe: Ergebnis = { ...LEER, probelauf, zeilen: [], diagnose: [] };
    let ab = 0;

    try {
      // Obergrenze der Runden: reine Notbremse gegen eine Endlosschleife.
      for (let runde = 0; runde < 500; runde++) {
        if (abbrechen.current) {
          summe.diagnose.push('Vom Benutzer angehalten.');
          break;
        }

        const res = await fetch('/api/lagerplatz/anlegen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ warehouseId, probelauf, tabelle, ab, maxAnlagen: 1000 }),
        });
        const d = (await alsJson(res)) as unknown as Antwort;
        if (!res.ok && !d.zeilen) throw new Error(d.error ?? `Fehlgeschlagen (HTTP ${res.status}).`);
        if (d.error) throw new Error(d.error);

        summe.bestehende = d.bestehende;
        summe.vorhanden += d.vorhanden;
        summe.geplant += d.geplant;
        summe.angelegt += d.angelegt;
        summe.uebersprungen += d.uebersprungen;
        summe.fehler += d.fehler;
        summe.neueKnoten += d.neueKnoten;
        summe.zeilen.push(...d.zeilen);
        if (runde === 0) summe.diagnose.push(...d.diagnose);

        setFortschritt({ fertig: d.naechsterIndex, gesamt: d.gesamtZeilen });
        // Zwischenstand sichtbar machen, damit der Lauf nachvollziehbar bleibt.
        setErgebnis({ ...summe, zeilen: [...summe.zeilen], offen: d.offen });

        if (d.offen === 0) break;

        // PlentyONE begrenzt Schreibzugriffe je Zeitfenster. Sofort weiter zu
        // machen hiesse, die restliche Liste in Fehler laufen zu lassen.
        if (d.schreiblimit) {
          for (let rest = 60; rest > 0 && !abbrechen.current; rest--) {
            setWartet(rest);
            await new Promise((fertig) => setTimeout(fertig, 1000));
          }
          setWartet(null);
        }

        if (d.naechsterIndex <= ab && !d.schreiblimit) {
          summe.diagnose.push('Der Lauf kam nicht weiter und wurde angehalten.');
          break;
        }
        ab = Math.max(ab, d.naechsterIndex);
      }

      setErgebnis({ ...summe, zeilen: [...summe.zeilen] });
      if (!probelauf) setFreigabe('');
    } catch (e) {
      setFehler((e as Error).message);
      setErgebnis({ ...summe, zeilen: [...summe.zeilen] });
    } finally {
      setWartet(null);
      setLaeuft(null);
    }
  }

  const sichtbar = useMemo(() => ergebnis?.zeilen.slice(0, 200) ?? [], [ergebnis]);
  const anteil = fortschritt && fortschritt.gesamt > 0
    ? Math.round((fortschritt.fertig / fortschritt.gesamt) * 100)
    : 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>PlentyONE</span>
        <h1 className={styles.title}>Lagerorte anlegen</h1>
        <p className={styles.subtitle}>
          Legt die Lagerorte über die REST-Schnittstelle an — dieselbe Struktur, die sonst in der Maske
          <em> Neue Lagerorte anlegen</em> Zeile für Zeile eingetippt wird. Was es schon gibt, wird erkannt und
          übersprungen; es entstehen keine Dubletten.
        </p>
      </header>

      {!plentyReady && <p className={`${styles.notice} ${styles.noticeWarn}`}>PlentyONE ist nicht konfiguriert.</p>}
      {fehler && <p className={`${styles.notice} ${styles.noticeErr}`}>{fehler}</p>}

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>1 · Lager wählen</h2></div>
        <div className={styles.controls}>
          <button type="button" className={styles.secondary} onClick={ladeLager} disabled={!!laeuft || !plentyReady}>
            {laeuft === 'lager' ? 'lädt …' : 'Lager laden'}
          </button>
          {lager.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="lager">Lager</label>
              <select id="lager" className={styles.select} value={warehouseId ?? ''}
                onChange={(e) => { const id = Number(e.target.value); setWarehouseId(id || null); if (id) pruefeLagerorte(id); }}>
                <option value="">— bitte wählen —</option>
                {lager.map((l) => <option key={l.id} value={l.id}>{l.name} (ID {l.id})</option>)}
              </select>
            </div>
          )}
        </div>
        {laeuft === 'orte' && <p className={styles.progress}>Lagerorte werden gelesen …</p>}
        {lagerInfo && <p className={styles.progress}>{lagerInfo}</p>}
        {unbekannt.length > 0 && (
          <>
            <p className={styles.checkHint}>
              So heißen Lagerorte, deren Namen sich nicht auf die einheitliche Form bringen lassen. Sie zählen
              bei der Zuweisung nicht mit:
            </p>
            <ul className={`${styles.diagnose} ${styles.mono}`}>
              {unbekannt.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>2 · Läufe einfügen</h2></div>
        <div className={styles.fieldFull}>
          <label className={styles.label} htmlFor="tabelle">
            Eine Zeile je Durchgang: Halle · Regal · Ebene · Feld · Lagerort
          </label>
          <textarea id="tabelle" className={styles.textarea} value={tabelle} spellCheck={false}
            placeholder={'Nr  Halle Regal Ebene Feld    Lagerort\n21   3     4     A     2       K 1-36\n23   2     7     A     7-9     0\n43   1     7     A     16-17   K 1-48'}
            onChange={(e) => { setTabelle(e.target.value); setErgebnis(null); }} disabled={!!laeuft} />
          <span className={styles.checkHint}>
            „K 1-36" heißt Kisten K01 bis K36 in jedem Feld, „0" heißt nur der Stellplatz ohne Kisten.
            Feldbereiche wie „16-17" sind erlaubt, eine laufende Nummer vorne darf stehenbleiben.
          </span>
        </div>
        {tabelle.trim() && (
          <p className={styles.progress}>
            <strong>{gelesen.laeufe}</strong> Läufe → <strong>{gelesen.codes.length.toLocaleString('de-DE')}</strong> Lagerorte
            {gelesen.doppelt > 0 && ` · ${gelesen.doppelt} doppelte aussortiert`}
            {gelesen.fehler.length > 0 && ` · ${gelesen.fehler.length} unlesbare Zeilen`}
          </p>
        )}
        {gelesen.fehler.length > 0 && (
          <ul className={styles.diagnose}>
            {gelesen.fehler.slice(0, 10).map((f) => <li key={f}>{f}</li>)}
            {gelesen.fehler.length > 10 && <li>… und {gelesen.fehler.length - 10} weitere</li>}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>3 · Probelauf</h2></div>
        <p className={styles.checkHint}>
          Vergleicht jeden Lagerort mit dem, was in Plenty schon steht, und zeigt, was neu entstehen würde.
          Es wird nichts geschrieben.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => starte(true)}
            disabled={!!laeuft || !warehouseId || !gelesen.codes.length}>
            {laeuft === 'probe' ? 'läuft …' : 'Probelauf starten'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>4 · Anlegen</h2></div>
        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="freigabe">Zum Bestätigen „ANLEGEN" eintippen</label>
            <input id="freigabe" className={styles.input} value={freigabe} placeholder="ANLEGEN"
              onChange={(e) => setFreigabe(e.target.value)} disabled={!!laeuft} />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => starte(false)}
              disabled={!!laeuft || !anlegenErlaubt}>
              {laeuft === 'anlegen' ? 'legt an …' : 'Jetzt anlegen'}
            </button>
            {laeuft && (
              <button type="button" className={styles.secondary} onClick={() => { abbrechen.current = true; }}>
                Anhalten
              </button>
            )}
          </div>
        </div>
        <p className={styles.checkHint}>
          Der Lauf teilt sich selbst in Blöcke auf und macht weiter, bis die Liste durch ist — einmal starten,
          Fenster offen lassen. Anhalten ist jederzeit möglich; schon angelegte Lagerorte bleiben bestehen.
        </p>
        {wartet !== null && (
          <p className={styles.progress}>
            PlentyONE bremst Schreibzugriffe — weiter in {wartet} s. Fenster offen lassen.
          </p>
        )}
        {fortschritt && (
          <>
            <p className={styles.progress}>
              {fortschritt.fertig.toLocaleString('de-DE')} von {fortschritt.gesamt.toLocaleString('de-DE')} Zeilen
              {laeuft ? ' …' : ' abgearbeitet'}
            </p>
            <div className={styles.bar}><div className={styles.barFill} style={{ width: `${anteil}%` }} /></div>
          </>
        )}
      </section>

      {ergebnis && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{ergebnis.probelauf ? 'Ergebnis des Probelaufs' : 'Angelegt'}</h2>
            <span className={styles.cellHint}>
              {ergebnis.bestehende.toLocaleString('de-DE')} Lagerorte waren vorher da
            </span>
          </div>
          <div className={styles.stats}>
            <div className={`${styles.stat} ${styles.statOk}`}>
              <div className={styles.statNum}>
                {(ergebnis.probelauf ? ergebnis.geplant : ergebnis.angelegt).toLocaleString('de-DE')}
              </div>
              <div className={styles.statLabel}>{ergebnis.probelauf ? 'würden entstehen' : 'angelegt'}</div>
            </div>
            <div className={`${styles.stat} ${styles.statMuted}`}>
              <div className={styles.statNum}>{ergebnis.vorhanden.toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>gab es schon</div>
            </div>
            <div className={`${styles.stat} ${styles.statWarn}`}>
              <div className={styles.statNum}>{ergebnis.neueKnoten.toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>neue Felder/Ebenen</div>
            </div>
            <div className={`${styles.stat} ${styles.statErr}`}>
              <div className={styles.statNum}>{ergebnis.fehler.toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>Fehler</div>
            </div>
          </div>

          {ergebnis.diagnose.length > 0 && (
            <ul className={styles.diagnose}>{ergebnis.diagnose.map((d) => <li key={d}>{d}</li>)}</ul>
          )}

          <div className={styles.cardHead} style={{ marginTop: '1.25rem' }}>
            <span className={styles.cellHint}>
              {sichtbar.length.toLocaleString('de-DE')} von {ergebnis.zeilen.length.toLocaleString('de-DE')} Zeilen
            </span>
            <button type="button" className={styles.secondary}
              onClick={() => ladeHerunter(
                ergebnis.probelauf ? 'lagerorte-probelauf.csv' : 'lagerorte-angelegt.csv',
                ['Lagerort;Status;Plenty-ID;Hinweis',
                  ...ergebnis.zeilen.map((z) => [z.code, z.status, z.id ?? '', (z.hinweis ?? '').replace(/[;\r\n]+/g, ' ')].join(';')),
                ].join('\r\n'))}>
              Als CSV
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Lagerort</th><th>Status</th><th>Plenty-ID</th><th>Hinweis</th></tr></thead>
              <tbody>
                {sichtbar.map((z, i) => (
                  <tr key={`${z.code}-${i}`}>
                    <td className={styles.mono}>{z.code}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        z.status === 'angelegt' ? styles.badgeOk
                          : z.status === 'geplant' ? styles.badgeOk
                          : z.status === 'fehler' ? styles.badgeErr
                          : z.status === 'uebersprungen' ? styles.badgeWarn
                          : styles.badgeMuted}`}>
                        {z.status}
                      </span>
                    </td>
                    <td className={styles.mono}>{z.id ?? '—'}</td>
                    <td className={styles.cellHint}>{z.hinweis ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ergebnis.zeilen.length > sichtbar.length && (
              <p className={styles.more}>
                Erste {sichtbar.length} Zeilen — der CSV-Export enthält alle.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import styles from '../lagerplatz.module.css';

interface Lager { id: number; name: string }
interface Zeile {
  variationId: number; itemId: number | null; ziel: string; zielId: number | null;
  zielName: string | null; menge: number | null;
  status: 'geplant' | 'gebucht' | 'uebersprungen' | 'fehler'; hinweis: string | null;
}
interface Ergebnis {
  ok: boolean; probelauf: boolean; error: string | null; lagerorte: number;
  geplant: number; gebucht: number; uebersprungen: number; fehler: number;
  zeilen: Zeile[]; diagnose: string[];
}
interface Wunsch { variationId: number; ziel: string; menge?: number | null; name?: string }

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
        ? 'Zeitüberschreitung — bitte mit einer kleineren Liste erneut versuchen.'
        : `Unerwartete Antwort (HTTP ${res.status}): ${anfang || 'leer'}`,
    );
  }
}

/** Liest die Zuweisungsliste aus einer CSV (Semikolon, mit Kopfzeile). */
function lesCsv(text: string): Wunsch[] {
  const zeilen = text.replace(/^﻿/, '').split(/\r?\n/).filter((z) => z.trim());
  if (!zeilen.length) return [];
  const kopf = zeilen[0].split(';').map((h) => h.trim().toLowerCase());
  const spalte = (...namen: string[]) => kopf.findIndex((h) => namen.some((n) => h.includes(n)));
  const iVar = spalte('variante-id', 'variationid');
  const iZiel = spalte('lagerplatz', 'ziel');
  const iMenge = spalte('bestand', 'menge');
  const iName = spalte('name');
  if (iVar < 0 || iZiel < 0) return [];
  return zeilen.slice(1).map((z) => {
    const s = z.split(';').map((f) => f.replace(/^"|"$/g, '').trim());
    return {
      variationId: Number(s[iVar]),
      ziel: s[iZiel] ?? '',
      menge: iMenge >= 0 && Number(s[iMenge]) > 0 ? Number(s[iMenge]) : null,
      name: iName >= 0 ? s[iName] : undefined,
    };
  }).filter((w) => w.variationId > 0 && w.ziel);
}

export default function Zuweisung({ plentyReady }: { plentyReady: boolean }) {
  const [lager, setLager] = useState<Lager[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [lagerInfo, setLagerInfo] = useState<string | null>(null);
  const [wuensche, setWuensche] = useState<Wunsch[]>([]);
  const [dateiname, setDateiname] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [maxBuchungen, setMaxBuchungen] = useState(20);
  const [freigabe, setFreigabe] = useState('');

  const buchenErlaubt = freigabe.trim().toUpperCase() === 'BUCHEN' && Boolean(warehouseId) && wuensche.length > 0;

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
      setLagerInfo(`${d.gesamt} Lagerorte, davon ${d.zuordenbar} zuordenbar` +
        (d.ohneCode ? ` · ${d.ohneCode} mit abweichendem Namen` : '') +
        (d.doppelt ? ` · ${d.doppelt} doppelt` : ''));
    } catch (e) { setFehler((e as Error).message); } finally { setLaeuft(null); }
  }

  async function starte(probelauf: boolean) {
    if (!warehouseId) return;
    setLaeuft(probelauf ? 'probe' : 'buchen'); setFehler(null); setErgebnis(null);
    try {
      const res = await fetch('/api/lagerplatz/zuweisen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId, probelauf, maxBuchungen,
          wuensche: wuensche.map((w) => ({ variationId: w.variationId, ziel: w.ziel, menge: w.menge })),
        }),
      });
      const d = (await alsJson(res)) as unknown as Ergebnis;
      if (!res.ok && !d.zeilen) throw new Error(d.error ?? `Fehlgeschlagen (HTTP ${res.status}).`);
      setErgebnis(d);
      if (!probelauf) setFreigabe('');
    } catch (e) { setFehler((e as Error).message); } finally { setLaeuft(null); }
  }

  const sichtbar = useMemo(() => ergebnis?.zeilen.slice(0, 200) ?? [], [ergebnis]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>PlentyONE</span>
        <h1 className={styles.title}>Lagerplätze zuweisen</h1>
        <p className={styles.subtitle}>
          Bucht den Bestand vom Standard-Lagerort auf den erkannten Lagerplatz um. In PlentyONE gibt es keine
          reine Zuordnung — ein Artikel liegt auf einem Platz, indem sein Bestand dorthin gebucht ist.
          <strong> Das bewegt echten Bestand und lässt sich nur durch Zurückbuchen rückgängig machen.</strong>
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
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>2 · Zuweisungsliste laden</h2></div>
        <input type="file" accept=".csv,text/csv" className={styles.input}
          onChange={async (e) => {
            const datei = e.target.files?.[0]; if (!datei) return;
            const gelesen = lesCsv(await datei.text());
            setWuensche(gelesen); setDateiname(datei.name); setErgebnis(null);
            if (!gelesen.length) setFehler('In der Datei wurden keine Zeilen mit Variante-ID und Lagerplatz gefunden.');
          }} />
        {dateiname && (
          <p className={styles.progress}>
            {dateiname} — <strong>{wuensche.length.toLocaleString('de-DE')}</strong> Zeilen gelesen
          </p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>3 · Probelauf</h2></div>
        <p className={styles.checkHint}>
          Prüft jede Zeile gegen die echten Lagerorte und zeigt, was gebucht würde. Es wird nichts geschrieben.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => starte(true)}
            disabled={!!laeuft || !warehouseId || !wuensche.length}>
            {laeuft === 'probe' ? 'läuft …' : 'Probelauf starten'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>4 · Buchen</h2></div>
        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="max">Höchstens buchen</label>
            <select id="max" className={styles.select} value={maxBuchungen}
              onChange={(e) => setMaxBuchungen(Number(e.target.value))} disabled={!!laeuft}>
              {[20, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n} Artikel</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="freigabe">Zum Bestätigen „BUCHEN" eintippen</label>
            <input id="freigabe" className={styles.input} value={freigabe} placeholder="BUCHEN"
              onChange={(e) => setFreigabe(e.target.value)} disabled={!!laeuft} />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => starte(false)}
              disabled={!!laeuft || !buchenErlaubt}>
              {laeuft === 'buchen' ? 'bucht …' : 'Jetzt buchen'}
            </button>
          </div>
        </div>
        <p className={styles.checkHint}>
          Fang klein an: 20 Artikel buchen, im Lager nachschauen, ob sie dort liegen. Erst dann größere Blöcke.
        </p>
      </section>

      {ergebnis && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{ergebnis.probelauf ? 'Ergebnis des Probelaufs' : 'Gebucht'}</h2>
            <span className={styles.cellHint}>{ergebnis.lagerorte.toLocaleString('de-DE')} Lagerorte gelesen</span>
          </div>
          <div className={styles.stats}>
            <div className={`${styles.stat} ${ergebnis.probelauf ? styles.statOk : styles.statOk}`}>
              <div className={styles.statNum}>{(ergebnis.probelauf ? ergebnis.geplant : ergebnis.gebucht).toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>{ergebnis.probelauf ? 'würden gebucht' : 'gebucht'}</div>
            </div>
            <div className={`${styles.stat} ${styles.statMuted}`}>
              <div className={styles.statNum}>{ergebnis.uebersprungen.toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>übersprungen</div>
            </div>
            <div className={`${styles.stat} ${styles.statErr}`}>
              <div className={styles.statNum}>{ergebnis.fehler.toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>Fehler</div>
            </div>
            <div className={`${styles.stat} ${styles.statWarn}`}>
              <div className={styles.statNum}>{ergebnis.zeilen.length.toLocaleString('de-DE')}</div>
              <div className={styles.statLabel}>Zeilen geprüft</div>
            </div>
          </div>
          {ergebnis.diagnose.length > 0 && (
            <ul className={styles.diagnose}>{ergebnis.diagnose.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Variante</th><th>Ziel-Lagerplatz</th><th>Menge</th><th>Status</th><th>Hinweis</th></tr>
              </thead>
              <tbody>
                {sichtbar.map((z) => (
                  <tr key={z.variationId}>
                    <td className={styles.mono}>{z.variationId}</td>
                    <td className={styles.mono}>{z.zielName ?? z.ziel}</td>
                    <td className={styles.mono}>{z.menge ?? '—'}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        z.status === 'gebucht' ? styles.badgeOk
                        : z.status === 'fehler' ? styles.badgeErr
                        : z.status === 'geplant' ? styles.badgeWarn : styles.badgeMuted}`}>
                        {z.status}
                      </span>
                    </td>
                    <td className={styles.cellHint}>{z.hinweis ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ergebnis.zeilen.length > sichtbar.length && (
              <p className={styles.more}>Es werden 200 von {ergebnis.zeilen.length.toLocaleString('de-DE')} Zeilen angezeigt.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { alsCsv, fasseZusammen, type Befund, type BefundStatus } from '@/lib/lagerplatz/befund';
import styles from './lagerplatz.module.css';

interface ScanAntwort {
  ok: boolean;
  konfiguriert: boolean;
  error: string | null;
  gelesen: number;
  geprueft: number;
  ohneBestand: number;
  vonSeite: number;
  bisSeite: number;
  naechsteSeite: number | null;
  fertig: boolean;
  gesamtLautPlenty: number | null;
  befunde: Befund[];
  diagnose: string[];
  dauerMs: number;
}

const FILTER: Array<{ wert: BefundStatus | 'alle'; text: string }> = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'gefunden', text: 'Gefunden' },
  { wert: 'unsicher', text: 'Unsicher' },
  { wert: 'konflikt', text: 'Konflikt' },
  { wert: 'kein-treffer', text: 'Ohne Lagerplatz' },
];

const MAX_ZEILEN = 300;

/** Lädt einen Text als Datei herunter (ohne Server-Umweg). */
function ladeHerunter(dateiname: string, inhalt: string) {
  // BOM, damit Excel die Umlaute richtig anzeigt.
  const blob = new Blob(['﻿' + inhalt], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LagerplatzScan({ plentyReady }: { plentyReady: boolean }) {
  const [befunde, setBefunde] = useState<Befund[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [diagnose, setDiagnose] = useState<string[]>([]);
  const [gelesen, setGelesen] = useState(0);
  const [geprueft, setGeprueft] = useState(0);
  const [quelle, setQuelle] = useState<'bestand' | 'alle'>('bestand');
  const [gesamt, setGesamt] = useState<number | null>(null);
  const [fertig, setFertig] = useState(false);
  const [proSeite, setProSeite] = useState(100);
  const [texteNachladen, setTexteNachladen] = useState(false);
  const [filter, setFilter] = useState<BefundStatus | 'alle'>('alle');
  const [suche, setSuche] = useState('');
  const abbruch = useRef(false);

  const zusammenfassung = useMemo(() => fasseZusammen(befunde), [befunde]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return befunde.filter((b) => {
      if (filter !== 'alle' && b.status !== filter) return false;
      if (!q) return true;
      return [b.code, b.nummer, b.name, String(b.variationId), String(b.itemId)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [befunde, filter, suche]);

  async function starte() {
    abbruch.current = false;
    setLaeuft(true);
    setFehler(null);
    setBefunde([]);
    setDiagnose([]);
    setGelesen(0);
    setGeprueft(0);
    setGesamt(null);
    setFertig(false);

    let seite = 1;
    let summe = 0;
    let summeGeprueft = 0;
    try {
      for (;;) {
        if (abbruch.current) break;
        const res = await fetch('/api/lagerplatz/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quelle, startSeite: seite, proSeite, maxSeiten: 8, texteNachladen }),
        });
        const daten = (await res.json()) as ScanAntwort;

        if (Array.isArray(daten.befunde) && daten.befunde.length) {
          setBefunde((alt) => {
            const bekannt = new Set(alt.map((b) => b.variationId));
            return [...alt, ...daten.befunde.filter((b) => !bekannt.has(b.variationId))];
          });
        }
        if (Array.isArray(daten.diagnose) && daten.diagnose.length) {
          setDiagnose((alt) => [...new Set([...alt, ...daten.diagnose])]);
        }
        summe += daten.gelesen ?? 0;
        summeGeprueft += daten.geprueft ?? 0;
        setGelesen(summe);
        setGeprueft(summeGeprueft);
        if (typeof daten.gesamtLautPlenty === 'number') setGesamt(daten.gesamtLautPlenty);

        if (!res.ok || daten.error) {
          setFehler(daten.error ?? `Scan fehlgeschlagen (HTTP ${res.status}).`);
          break;
        }
        if (daten.fertig || daten.naechsteSeite === null) {
          setFertig(true);
          break;
        }
        seite = daten.naechsteSeite;
      }
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaeuft(false);
    }
  }

  const fortschritt = gesamt && gesamt > 0 ? Math.min(100, Math.round((gelesen / gesamt) * 100)) : null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>PlentyONE</span>
        <h1 className={styles.title}>Lagerplätze finden</h1>
        <p className={styles.subtitle}>
          Geht <strong>jeden Artikel mit Bestand</strong> in Plenty durch und liest den Lagerplatz aus seinen
          Texten — Variantennummer, Modell, Externe ID, Name und Artikelbeschreibung. Codes wie{' '}
          <strong>H6R5A7</strong> werden auch in abweichender Schreibweise erkannt („h6-r5-a7",
          „Halle 6 Regal 5 Ablage 7"). Dieser Durchlauf <strong>liest nur</strong>; in Plenty wird nichts
          verändert.
        </p>
      </header>

      {!plentyReady && (
        <p className={`${styles.notice} ${styles.noticeWarn}`}>
          PlentyONE ist nicht konfiguriert — es fehlen PLENTY_BASE_URL, PLENTY_USER oder PLENTY_PASSWORD.
        </p>
      )}
      {fehler && <p className={`${styles.notice} ${styles.noticeErr}`}>{fehler}</p>}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Durchlauf</h2>
          {befunde.length > 0 && !laeuft && (
            <span className={styles.cellHint}>{fertig ? 'vollständig durchsucht' : 'abgebrochen'}</span>
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="quelle">
              Welche Artikel
            </label>
            <select
              id="quelle"
              className={styles.select}
              value={quelle}
              onChange={(e) => setQuelle(e.target.value as 'bestand' | 'alle')}
              disabled={laeuft}
            >
              <option value="bestand">Nur mit Bestand</option>
              <option value="alle">Gesamter Artikelstamm</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="proSeite">
              Zeilen pro Abruf
            </label>
            <select
              id="proSeite"
              className={styles.select}
              value={proSeite}
              onChange={(e) => setProSeite(Number(e.target.value))}
              disabled={laeuft}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Beschreibungen</span>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={texteNachladen}
                onChange={(e) => setTexteNachladen(e.target.checked)}
                disabled={laeuft}
              />
              einzeln nachladen
            </label>
            <span className={styles.checkHint}>
              Nötig, wenn der Lagerplatz nur in der Artikelbeschreibung steht. Deutlich langsamer, weil
              Plenty die Texte nicht in der Liste mitliefert.
            </span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={starte} disabled={laeuft || !plentyReady}>
              {laeuft ? 'Scan läuft …' : 'Scan starten'}
            </button>
            {laeuft && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  abbruch.current = true;
                }}
              >
                Anhalten
              </button>
            )}
          </div>
        </div>

        {(laeuft || gelesen > 0) && (
          <div className={styles.progress}>
            {quelle === 'bestand'
              ? `${gelesen.toLocaleString('de-DE')} Bestandszeilen gelesen`
              : `${gelesen.toLocaleString('de-DE')} Varianten gelesen`}
            {gesamt ? ` von ${gesamt.toLocaleString('de-DE')}` : ''}
            {quelle === 'bestand' && ` · ${geprueft.toLocaleString('de-DE')} Artikel mit Bestand geprüft`}
            {fortschritt !== null && (
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${fortschritt}%` }} />
              </div>
            )}
          </div>
        )}

        {diagnose.length > 0 && (
          <ul className={styles.diagnose}>
            {diagnose.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </section>

      {befunde.length > 0 && (
        <>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Ergebnis</h2>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => ladeHerunter('lagerplaetze-artikel.csv', alsCsv(befunde))}
                >
                  Alles als CSV
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() =>
                    ladeHerunter(
                      'lagerplaetze-liste.csv',
                      ['Lagerplatz;Klartext;Artikel', ...zusammenfassung.plaetze.map((p) => `${p.code};${p.klartext};${p.anzahl}`)].join('\r\n'),
                    )
                  }
                >
                  Lagerplatz-Liste als CSV
                </button>
              </div>
            </div>

            <div className={styles.stats}>
              <div className={`${styles.stat} ${styles.statOk}`}>
                <div className={styles.statNum}>{zusammenfassung.gefunden.toLocaleString('de-DE')}</div>
                <div className={styles.statLabel}>Lagerplatz erkannt</div>
              </div>
              <div className={`${styles.stat} ${styles.statWarn}`}>
                <div className={styles.statNum}>{zusammenfassung.unsicher.toLocaleString('de-DE')}</div>
                <div className={styles.statLabel}>Unsicher — bitte prüfen</div>
              </div>
              <div className={`${styles.stat} ${styles.statErr}`}>
                <div className={styles.statNum}>{zusammenfassung.konflikt.toLocaleString('de-DE')}</div>
                <div className={styles.statLabel}>Widersprüchlich</div>
              </div>
              <div className={`${styles.stat} ${styles.statMuted}`}>
                <div className={styles.statNum}>{zusammenfassung.ohneTreffer.toLocaleString('de-DE')}</div>
                <div className={styles.statLabel}>Ohne Lagerplatz</div>
              </div>
            </div>

            <p className={styles.hint}>
              {zusammenfassung.plaetze.length.toLocaleString('de-DE')} verschiedene Lagerplätze — so viele
              müssten in Plenty angelegt werden.{' '}
              {zusammenfassung.ohneTreffer > 0 && (
                <>
                  Bei {zusammenfassung.ohneTreffer.toLocaleString('de-DE')} Artikeln mit Bestand steht nirgends
                  ein Lagerplatz — die müssen aufgenommen werden.
                </>
              )}
            </p>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Gefundene Lagerplätze</h2>
            </div>
            <div className={styles.places}>
              {zusammenfassung.plaetze.slice(0, 200).map((p) => (
                <span key={p.code} className={styles.place} title={p.klartext}>
                  <span className={styles.placeCode}>{p.code}</span>
                  <span className={styles.placeText}>{p.klartext}</span>
                  <span className={styles.placeCount}>{p.anzahl}</span>
                </span>
              ))}
            </div>
            {zusammenfassung.plaetze.length > 200 && (
              <p className={styles.more}>… und {zusammenfassung.plaetze.length - 200} weitere (siehe CSV)</p>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Artikel im Einzelnen</h2>
              <span className={styles.cellHint}>{sichtbar.length.toLocaleString('de-DE')} Treffer</span>
            </div>

            <div className={styles.filters}>
              {FILTER.map((f) => (
                <button
                  key={f.wert}
                  type="button"
                  className={`${styles.tab} ${filter === f.wert ? styles.tabActive : ''}`}
                  onClick={() => setFilter(f.wert)}
                >
                  {f.text}
                </button>
              ))}
              <input
                className={`${styles.input} ${styles.search}`}
                placeholder="Suchen: Lagerplatz, Variantennummer, Name …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </div>

            {sichtbar.length === 0 ? (
              <p className={styles.empty}>Keine Artikel in dieser Auswahl.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Lagerplatz</th>
                      <th>Bestand</th>
                      <th>Lager</th>
                      <th>Variantennummer</th>
                      <th>Name</th>
                      <th>Quelle</th>
                      <th>Status</th>
                      <th>Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sichtbar.slice(0, MAX_ZEILEN).map((b) => (
                      <tr key={b.variationId}>
                        <td className={styles.mono}>{b.code ?? '—'}</td>
                        <td className={styles.mono}>{b.bestandPhysisch ?? b.bestand ?? '—'}</td>
                        <td className={styles.cellHint}>{b.lager ?? '—'}</td>
                        <td className={styles.mono}>{b.nummer ?? '—'}</td>
                        <td className={styles.cellName} title={b.name ?? ''}>
                          {b.name ?? '—'}
                        </td>
                        <td className={styles.cellHint}>{b.quelle ?? '—'}</td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                        <td className={styles.cellHint}>{b.hinweis ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sichtbar.length > MAX_ZEILEN && (
                  <p className={styles.more}>
                    Es werden {MAX_ZEILEN} von {sichtbar.length.toLocaleString('de-DE')} Zeilen angezeigt — der
                    CSV-Export enthält alle.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BefundStatus }) {
  const map: Record<BefundStatus, { klasse: string; text: string }> = {
    gefunden: { klasse: styles.badgeOk, text: 'gefunden' },
    unsicher: { klasse: styles.badgeWarn, text: 'unsicher' },
    konflikt: { klasse: styles.badgeErr, text: 'Konflikt' },
    'kein-treffer': { klasse: styles.badgeMuted, text: 'ohne Lagerplatz' },
  };
  const { klasse, text } = map[status];
  return <span className={`${styles.badge} ${klasse}`}>{text}</span>;
}

'use client';

/**
 * Einstellungen: PlentyONE-Zugang pflegen und alle Werkzeuge von einer Stelle
 * aus erreichen.
 *
 * Zwei Grundsätze in dieser Oberfläche:
 *
 *   1. Das Passwort verlässt den Server nie. Das Feld ist beim Laden leer;
 *      daneben steht, ob und wie ein Passwort hinterlegt ist. Leer lassen
 *      heißt „unverändert" — man kann also die URL ändern, ohne das Passwort
 *      erneut eintippen zu müssen.
 *
 *   2. Testen vor dem Speichern. Ein falscher Zugang, der gespeichert wird,
 *      legt alle Werkzeuge für alle Kollegen lahm. Deshalb prüft „Verbindung
 *      testen" die eingetippten Werte, ohne sie zu speichern.
 */

import { useCallback, useEffect, useState } from 'react';
import styles from './einstellungen.module.css';

type Quelle = 'datenbank' | 'umgebung' | 'leer';

interface Stand {
  baseUrl: string;
  user: string;
  passwortGesetzt: boolean;
  passwortMaske: string | null;
  passwortUnlesbar: boolean;
  plentyId: number | null;
  warehouseId: number | null;
  quelle: Quelle;
  geaendertVon: string | null;
  geaendertAm: string | null;
  schluessel: 'eigen' | 'supabase' | 'keiner';
}

/** Die Werkzeuge, die auf diesem Zugang aufsetzen. */
const PROZESSE = [
  {
    href: '/projekte',
    name: 'Projekte anlegen',
    text: 'Firma, Ort und Ansprechpartner erfassen, Kategorie und Artikel in Plenty anlegen, EAN-13 erzeugen.',
    schreibt: true,
  },
  {
    href: '/lagerplatz',
    name: 'Lagerplätze finden',
    text: 'Geht die Artikel mit Bestand durch und liest Lagerplatz-Codes aus ihren Texten.',
    schreibt: false,
  },
  {
    href: '/lagerplatz/anlegen',
    name: 'Lagerorte anlegen',
    text: 'Legt fehlende Lagerorte in Plenty an — Halle, Regal, Ebene, Fach.',
    schreibt: true,
  },
  {
    href: '/lagerplatz/zuweisen',
    name: 'Zuweisen',
    text: 'Bucht Bestand vom Standard-Lagerplatz auf den richtigen Platz um.',
    schreibt: true,
  },
  {
    href: '/lagerplatz/suche',
    name: 'Artikel suchen',
    text: 'Artikel nicht gefunden? Schlägt alternative Lagerplätze vor, mit Begründung und Laufzettel.',
    schreibt: false,
  },
];

const QUELLE_TEXT: Record<Quelle, string> = {
  datenbank: 'aus diesen Einstellungen',
  umgebung: 'aus den Umgebungsvariablen (Vercel)',
  leer: 'nicht eingerichtet',
};

async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unerwartete Antwort (HTTP ${res.status}).`);
  }
}

export default function Einstellungen() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [benutzer, setBenutzer] = useState('');
  const [passwort, setPasswort] = useState('');
  const [plentyId, setPlentyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [laedt, setLaedt] = useState(true);
  const [laeuft, setLaeuft] = useState<'test' | 'speichern' | 'verwerfen' | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const daten = (await alsJson(await fetch('/api/einstellungen/plenty'))) as unknown as Stand;
      setStand(daten);
      setBaseUrl(daten.baseUrl ?? '');
      setBenutzer(daten.user ?? '');
      setPlentyId(daten.plentyId !== null ? String(daten.plentyId) : '');
      setWarehouseId(daten.warehouseId !== null ? String(daten.warehouseId) : '');
      setPasswort(''); // nie vorbelegen
    } catch (err) {
      setMeldung({ art: 'err', text: (err as Error).message });
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const koerper = () => ({
    baseUrl,
    user: benutzer,
    passwort,
    plentyId: plentyId === '' ? null : Number(plentyId),
    warehouseId: warehouseId === '' ? null : Number(warehouseId),
  });

  async function testen() {
    setLaeuft('test');
    setMeldung(null);
    try {
      const res = await fetch('/api/einstellungen/plenty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper()),
      });
      const daten = await alsJson(res);
      setMeldung({
        art: daten.ok ? 'ok' : 'err',
        text: String(daten.message ?? daten.error ?? 'Unbekanntes Ergebnis.'),
      });
    } catch (err) {
      setMeldung({ art: 'err', text: (err as Error).message });
    } finally {
      setLaeuft(null);
    }
  }

  async function speichern() {
    setLaeuft('speichern');
    setMeldung(null);
    try {
      const res = await fetch('/api/einstellungen/plenty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper()),
      });
      const daten = await alsJson(res);
      if (!res.ok) throw new Error(String(daten.error ?? 'Speichern fehlgeschlagen.'));
      const test = daten.test as { ok: boolean; message: string } | undefined;
      setMeldung(
        test?.ok
          ? { art: 'ok', text: `Gespeichert. ${test.message}` }
          : { art: 'warn', text: `Gespeichert, aber der Zugang trägt nicht: ${test?.message ?? 'unklar'}` },
      );
      await laden();
    } catch (err) {
      setMeldung({ art: 'err', text: (err as Error).message });
    } finally {
      setLaeuft(null);
    }
  }

  async function verwerfen() {
    if (!confirm('Gespeicherten Zugang löschen? Danach gelten wieder die Umgebungsvariablen aus Vercel.')) return;
    setLaeuft('verwerfen');
    setMeldung(null);
    try {
      const res = await fetch('/api/einstellungen/plenty', { method: 'DELETE' });
      const daten = await alsJson(res);
      if (!res.ok) throw new Error(String(daten.error ?? 'Löschen fehlgeschlagen.'));
      setMeldung({ art: 'ok', text: 'Zugang gelöscht — es gelten wieder die Umgebungsvariablen.' });
      await laden();
    } catch (err) {
      setMeldung({ art: 'err', text: (err as Error).message });
    } finally {
      setLaeuft(null);
    }
  }

  const beschaeftigt = laeuft !== null || laedt;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Einrichtung</span>
        <h1 className={styles.title}>Einstellungen</h1>
        <p className={styles.subtitle}>
          Hier hängt alles dran: Projekte anlegen, Lagerorte anlegen, Zuweisen und die Artikelsuche
          holen ihren PlentyONE-Zugang von dieser Seite. Eine Änderung wirkt sofort — ohne neuen
          Deploy bei Vercel.
        </p>
      </header>

      {meldung && (
        <div
          className={`${styles.notice} ${
            meldung.art === 'ok' ? styles.noticeOk : meldung.art === 'warn' ? styles.noticeWarn : styles.noticeErr
          }`}
        >
          {meldung.text}
        </div>
      )}

      {stand?.passwortUnlesbar && (
        <div className={`${styles.notice} ${styles.noticeWarn}`}>
          Das gespeicherte Passwort lässt sich nicht mehr entschlüsseln — vermutlich hat sich der
          Schlüssel geändert (etwa weil der Supabase-Service-Role-Key gedreht wurde). Bitte einmal
          neu eintragen und speichern.
        </div>
      )}

      {stand?.schluessel === 'keiner' && (
        <div className={`${styles.notice} ${styles.noticeErr}`}>
          Es fehlt ein Schlüssel zum Verschlüsseln des Passworts. Ohne <code>EINSTELLUNGEN_SCHLUESSEL</code>{' '}
          oder <code>SUPABASE_SERVICE_ROLE_KEY</code> wird nichts gespeichert.
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>PlentyONE-Zugang</h2>
          <span
            className={`${styles.badge} ${
              stand?.quelle === 'leer' ? styles.badgeWarn : stand?.quelle === 'datenbank' ? styles.badgeOk : styles.badgeMuted
            }`}
          >
            {stand ? QUELLE_TEXT[stand.quelle] : '…'}
          </span>
        </div>

        {stand && (
          <div className={styles.herkunft}>
            <div className={styles.herkunftZeile}>
              <span>Passwort:</span>
              <strong>
                {stand.passwortGesetzt ? `hinterlegt (${stand.passwortMaske})` : 'keines hinterlegt'}
              </strong>
            </div>
            {stand.geaendertAm && (
              <div className={styles.herkunftZeile}>
                <span>Zuletzt gespeichert:</span>
                <strong>
                  {new Date(stand.geaendertAm).toLocaleString('de-DE')}
                  {stand.geaendertVon ? ` von ${stand.geaendertVon}` : ''}
                </strong>
              </div>
            )}
          </div>
        )}

        <div className={styles.felder}>
          <div className={styles.feld}>
            <label className={styles.label} htmlFor="baseUrl">Basis-URL</label>
            <input
              id="baseUrl"
              className={styles.input}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://ihr-shop.plentymarkets-cloud01.com"
              autoComplete="off"
            />
            <span className={styles.hilfe}>
              Ohne <code>/rest</code> am Ende — das hängt die App selbst an. Muss mit <code>https://</code> beginnen.
            </span>
          </div>

          <div className={styles.feld}>
            <label className={styles.label} htmlFor="benutzer">REST-Benutzer</label>
            <input
              id="benutzer"
              className={styles.input}
              value={benutzer}
              onChange={(e) => setBenutzer(e.target.value)}
              autoComplete="off"
            />
            <span className={styles.hilfe}>
              Braucht Leserechte auf Artikel, Varianten, Bestand und Lager; zum Anlegen und Zuweisen
              zusätzlich Schreibrechte auf Lagerorte und Bestand.
            </span>
          </div>

          <div className={styles.feld}>
            <label className={styles.label} htmlFor="passwort">Passwort</label>
            <input
              id="passwort"
              className={styles.input}
              type="password"
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              placeholder={stand?.passwortGesetzt ? 'unverändert lassen' : 'Passwort eintragen'}
              autoComplete="new-password"
            />
            <span className={styles.hilfe}>
              Wird verschlüsselt gespeichert und nie wieder angezeigt. Leer lassen heißt: das
              bisherige Passwort bleibt.
            </span>
          </div>

          <div className={styles.zwei}>
            <div className={styles.feld}>
              <label className={styles.label} htmlFor="plentyId">Mandant (plentyId)</label>
              <input
                id="plentyId"
                className={styles.input}
                value={plentyId}
                onChange={(e) => setPlentyId(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                inputMode="numeric"
              />
            </div>
            <div className={styles.feld}>
              <label className={styles.label} htmlFor="warehouseId">Standard-Lager</label>
              <input
                id="warehouseId"
                className={styles.input}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value.replace(/\D/g, ''))}
                placeholder="leer = das erste"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        <div className={styles.aktionen}>
          <button className={styles.secondary} onClick={testen} disabled={beschaeftigt || !baseUrl || !benutzer}>
            {laeuft === 'test' ? 'Prüft …' : 'Verbindung testen'}
          </button>
          <button className={styles.primary} onClick={speichern} disabled={beschaeftigt || !baseUrl || !benutzer}>
            {laeuft === 'speichern' ? 'Speichert …' : 'Speichern'}
          </button>
          {stand?.quelle === 'datenbank' && (
            <button className={`${styles.secondary} ${styles.gefahr}`} onClick={verwerfen} disabled={beschaeftigt}>
              Zugang löschen
            </button>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Prozesse</h2>
          <span className={styles.hilfe}>alle auf diesem Zugang</span>
        </div>
        <div className={styles.prozesse}>
          {PROZESSE.map((p) => (
            <a key={p.href} href={p.href} className={styles.prozess}>
              <div className={styles.prozessName}>{p.name}</div>
              <div className={styles.prozessText}>{p.text}</div>
              <div className={styles.prozessSchreibt}>
                <span className={`${styles.badge} ${p.schreibt ? styles.badgeWarn : styles.badgeMuted}`}>
                  {p.schreibt ? 'schreibt in Plenty' : 'nur lesend'}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

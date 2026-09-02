'use client';

/**
 * Kuechenansicht — das Bild, das im Laden auf dem Tablet steht.
 *
 * Holt alle 10 Sekunden die offenen Bestellungen und legt sie in drei Spalten:
 * Neu, In Arbeit, Fertig. Eine neue Bestellung gibt einen Signalton und blinkt
 * kurz. Der Zugangscode wird einmal eingegeben und bleibt danach auf dem Geraet
 * gespeichert, damit im Betrieb niemand tippen muss.
 *
 * Kurzes Abfragen statt einer dauerhaften Verbindung: das ueberlebt WLAN-
 * Aussetzer und ein Tablet, das zwischendurch schlafen geht, ohne Sonderfaelle.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Order, OrderStatus } from '@/lib/sapore/orders';
import { formatPrice } from '@/lib/sapore/menu';
import styles from './kueche.module.css';

const STORAGE_KEY = 'sapore-grill:kitchen-token';
const POLL_MS = 10_000;

type Loaded = { open: Order[]; closed: Order[] };

/** Kurzer Doppelton ueber die WebAudio-API — kein Tondatei-Download noetig. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.24);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    /* Ton ist Beiwerk — ohne ihn bleibt die Ansicht vollstaendig bedienbar. */
  }
}

function minutesSince(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function KitchenBoard() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [data, setData] = useState<Loaded>({ open: [], closed: [] });
  const [error, setError] = useState('');
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setToken(saved);
    } catch {
      /* Gesperrter Speicher: dann eben bei jedem Aufruf einmal eingeben. */
    }
  }, []);

  const load = useCallback(
    async (currentToken: string) => {
      setLoading(true);
      try {
        const response = await fetch('/api/sapore-grill/kitchen', {
          headers: { Authorization: `Bearer ${currentToken}` },
          cache: 'no-store',
        });
        const json = (await response.json()) as { ok?: boolean; open?: Order[]; closed?: Order[]; error?: string };

        if (response.status === 401) {
          setToken(null);
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* egal */
          }
          setError(json.error || 'Zugang abgelehnt.');
          return;
        }
        if (!response.ok || !json.ok) {
          setError(json.error || 'Bestellungen konnten nicht geladen werden.');
          return;
        }

        const open = json.open ?? [];

        // Neue Bestellungen erkennen — beim allerersten Laden nicht laermen.
        const fresh = new Set<string>();
        open.forEach((o) => {
          if (o.id && !knownIds.current.has(o.id)) {
            if (!firstLoad.current) fresh.add(o.id);
            knownIds.current.add(o.id);
          }
        });
        if (fresh.size > 0) {
          setFreshIds(fresh);
          if (sound) beep();
          window.setTimeout(() => setFreshIds(new Set()), 8000);
        }
        firstLoad.current = false;

        setData({ open, closed: json.closed ?? [] });
        setError('');
        setLastOk(new Date());
      } catch {
        setError('Keine Verbindung zum Server. Nächster Versuch in wenigen Sekunden.');
      } finally {
        setLoading(false);
      }
    },
    [sound],
  );

  useEffect(() => {
    if (!token) return;
    load(token);
    const id = window.setInterval(() => load(token), POLL_MS);
    return () => window.clearInterval(id);
  }, [token, load]);

  async function move(order: Order, status: OrderStatus) {
    if (!token || !order.id) return;
    setBusyId(order.id);
    try {
      const response = await fetch('/api/sapore-grill/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: order.id, status }),
      });
      if (!response.ok) {
        setError('Status konnte nicht geändert werden. Bitte erneut tippen.');
        return;
      }
      await load(token);
    } finally {
      setBusyId(null);
    }
  }

  /* --- Anmeldung ------------------------------------------------------- */

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.login}>
          <h1 className={styles.loginTitle}>Küchenansicht</h1>
          <p className={styles.loginText}>
            Zugangscode einmal eingeben — dieses Gerät merkt ihn sich danach. Nur auf
            Geräten im Laden verwenden: hier stehen Namen, Telefonnummern und Adressen der
            Gäste.
          </p>
          <form
            className={styles.loginForm}
            onSubmit={(e) => {
              e.preventDefault();
              const value = tokenInput.trim();
              if (!value) return;
              try {
                window.localStorage.setItem(STORAGE_KEY, value);
              } catch {
                /* egal — der Code gilt dann nur für diese Sitzung */
              }
              firstLoad.current = true;
              knownIds.current = new Set();
              setToken(value);
              setTokenInput('');
              // Erste Nutzergeste: Ton hier freischalten, damit er später darf.
              if (sound) beep();
            }}
          >
            <label className={styles.srOnly} htmlFor="kitchen-token">
              Zugangscode
            </label>
            <input
              id="kitchen-token"
              className={styles.input}
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Zugangscode"
              autoComplete="off"
            />
            <button type="submit" className={`${styles.action} ${styles.actionPrimary}`}>
              Anmelden
            </button>
            {error ? <p className={styles.error}>{error}</p> : null}
          </form>
        </div>
      </div>
    );
  }

  /* --- Tafel ----------------------------------------------------------- */

  const columns: Array<{ key: OrderStatus; title: string; next?: OrderStatus; nextLabel?: string }> = [
    { key: 'neu', title: 'Neu', next: 'in_arbeit', nextLabel: 'Annehmen' },
    { key: 'in_arbeit', title: 'In Arbeit', next: 'fertig', nextLabel: 'Fertig' },
    { key: 'fertig', title: 'Fertig', next: 'abgeschlossen', nextLabel: 'Übergeben' },
  ];

  const stale = lastOk ? Date.now() - lastOk.getTime() > POLL_MS * 3 : true;
  const neuCount = data.open.filter((o) => o.status === 'neu').length;

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.shell}>
          <div className={styles.barInner}>
            <h1 className={styles.title}>
              Sapore Grill — Küche
              <span className={styles.titleSub}>
                {data.open.length} offene {data.open.length === 1 ? 'Bestellung' : 'Bestellungen'}
              </span>
            </h1>

            <span className={styles.live}>
              <span className={`${styles.liveDot} ${stale ? styles.liveDotStale : ''}`} />
              {loading
                ? 'Wird aktualisiert …'
                : lastOk
                  ? `Stand ${lastOk.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Noch keine Daten'}
            </span>

            <button
              type="button"
              className={`${styles.barBtn} ${sound ? styles.barBtnOn : ''}`}
              onClick={() => {
                const next = !sound;
                setSound(next);
                if (next) beep();
              }}
              aria-pressed={sound}
            >
              Ton {sound ? 'an' : 'aus'}
            </button>

            <button type="button" className={styles.barBtn} onClick={() => load(token)}>
              Jetzt aktualisieren
            </button>
          </div>
        </div>
      </div>

      {/* Eine ruhige, zusammenhaengende Statusmeldung statt einer nackten Zahl. */}
      <p className={styles.srOnly} role="status" aria-atomic="true">
        {neuCount === 0
          ? 'Keine neuen Bestellungen'
          : `${neuCount} neue ${neuCount === 1 ? 'Bestellung' : 'Bestellungen'}`}
      </p>

      <div className={styles.shell}>
        {error ? <div className={styles.alert}>{error}</div> : null}

        <div className={styles.columns}>
          {columns.map((col) => {
            const orders = data.open.filter((o) => o.status === col.key);
            return (
              <section key={col.key} className={styles.column}>
                <div className={styles.columnHead}>
                  <h2 className={styles.columnTitle}>{col.title}</h2>
                  <span className={styles.columnCount}>{orders.length}</span>
                </div>

                <div className={styles.cards}>
                  {orders.length === 0 ? (
                    <p className={styles.empty}>Nichts hier.</p>
                  ) : (
                    orders.map((order) => {
                      const age = minutesSince(order.created_at);
                      const fresh = order.id ? freshIds.has(order.id) : false;
                      const cardTone =
                        col.key === 'neu' ? styles.cardNeu : col.key === 'in_arbeit' ? styles.cardArbeit : styles.cardFertig;
                      return (
                        <article
                          key={order.id}
                          className={`${styles.card} ${cardTone} ${fresh ? styles.cardFresh : ''}`}
                        >
                          <div className={styles.cardTop}>
                            <span className={styles.orderNo}>{order.order_no}</span>
                            <span
                              className={`${styles.mode} ${order.mode === 'liefern' ? styles.modeLiefern : styles.modeAbholen}`}
                            >
                              {order.mode === 'liefern' ? 'Liefern' : 'Abholen'}
                            </span>
                            <span className={`${styles.age} ${age >= 20 ? styles.ageLate : ''}`}>
                              vor {age} Min.
                            </span>
                          </div>

                          <ul className={styles.lines}>
                            {order.items.map((line) => (
                              <li key={line.id}>
                                <span className={styles.qty}>{line.qty}×</span>
                                <span>{line.name}</span>
                              </li>
                            ))}
                          </ul>

                          {order.note ? <p className={styles.note}>{order.note}</p> : null}

                          <div className={styles.meta}>
                            <span className={styles.metaStrong}>{order.customer_name}</span>
                            <a className={styles.metaStrong} href={`tel:${order.customer_phone}`}>
                              {order.customer_phone}
                            </a>
                            {order.mode === 'liefern' ? (
                              <span>
                                {order.street}, {order.zip} {order.city}
                              </span>
                            ) : null}
                            <span>
                              Zeit: {order.wish_time === 'sofort' ? 'so schnell wie möglich' : `${order.wish_time} Uhr`}
                            </span>
                            <span className={styles.total}>{formatPrice(order.total)}</span>
                          </div>

                          <div className={styles.actions}>
                            {col.next ? (
                              <button
                                type="button"
                                className={`${styles.action} ${styles.actionPrimary}`}
                                onClick={() => move(order, col.next as OrderStatus)}
                                disabled={busyId === order.id}
                              >
                                {busyId === order.id ? 'Moment …' : col.nextLabel}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={`${styles.action} ${styles.actionQuiet}`}
                              onClick={() => move(order, 'storniert')}
                              disabled={busyId === order.id}
                            >
                              Storno
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

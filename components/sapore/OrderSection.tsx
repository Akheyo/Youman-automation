'use client';

/**
 * Sapore Grill — Speisekarte, Warenkorb und Bestellstrecke.
 *
 * Ablauf: Kategorie waehlen -> Gerichte in den Warenkorb -> Liefern oder
 * Abholen -> Kontaktdaten -> absenden an `/api/sapore-grill/order`.
 *
 * Der Warenkorb liegt im `localStorage`, damit ein versehentlicher Reload die
 * Bestellung nicht loescht. Preise und Gerichte kommen aus `lib/sapore/menu.ts`
 * und sind bis zur echten Karte Platzhalter.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUSINESS,
  DELIVERY,
  MENU,
  MENU_IS_PLACEHOLDER,
  findItem,
  formatPrice,
} from '@/lib/sapore/menu';
import styles from './sapore.module.css';
import { Reveal } from './Sections';
import {
  IconAlert,
  IconBag,
  IconCart,
  IconCheck,
  IconCopy,
  IconInfo,
  IconMinus,
  IconMoped,
  IconPhone,
  IconPlus,
  IconTrash,
} from './Icons';

type Mode = 'liefern' | 'abholen';
type CartLines = Record<string, number>;
type Errors = Record<string, string>;

const STORAGE_KEY = 'sapore-grill:cart:v1';

type SubmittedOrder = {
  orderNo: string;
  mode: Mode;
  total: number;
  eta: string;
  text: string;
};

export default function OrderSection() {
  const [category, setCategory] = useState(MENU[0]?.id ?? '');
  const [lines, setLines] = useState<CartLines>({});
  const [mode, setMode] = useState<Mode>('abholen');
  const [hydrated, setHydrated] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    street: '',
    zip: '',
    city: BUSINESS.city,
    time: 'sofort',
    note: '',
    consent: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState<SubmittedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);

  /* Warenkorb aus dem Browser-Speicher holen — erst nach dem Mounten, damit
     Server- und Client-HTML identisch starten. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { lines?: CartLines; mode?: Mode };
        if (parsed.lines) {
          // Nur Positionen uebernehmen, die es in der aktuellen Karte noch gibt.
          const clean: CartLines = {};
          Object.entries(parsed.lines).forEach(([id, qty]) => {
            if (findItem(id) && Number.isFinite(qty) && qty > 0) clean[id] = Math.min(qty, 99);
          });
          setLines(clean);
        }
        if (parsed.mode === 'liefern' || parsed.mode === 'abholen') setMode(parsed.mode);
      }
    } catch {
      /* Kaputter oder gesperrter Speicher: einfach mit leerem Warenkorb starten. */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, mode }));
    } catch {
      /* Speichern ist optional — ohne ihn funktioniert die Bestellung genauso. */
    }
  }, [lines, mode, hydrated]);

  const cart = useMemo(() => {
    const entries = Object.entries(lines)
      .map(([id, qty]) => {
        const item = findItem(id);
        return item ? { item, qty } : null;
      })
      .filter((entry): entry is { item: NonNullable<ReturnType<typeof findItem>>; qty: number } => entry !== null);

    const count = entries.reduce((sum, entry) => sum + entry.qty, 0);
    const subtotal = entries.reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
    const feeApplies = mode === 'liefern' && subtotal > 0 && subtotal < DELIVERY.freeFrom;
    const fee = feeApplies ? DELIVERY.fee : 0;
    const belowMin = mode === 'liefern' && subtotal > 0 && subtotal < DELIVERY.minOrder;

    return { entries, count, subtotal, fee, total: subtotal + fee, belowMin, feeApplies };
  }, [lines, mode]);

  const activeCategory = MENU.find((c) => c.id === category) ?? MENU[0];
  // Leere Karte: nichts rendern, statt mit `undefined` weiterzuarbeiten.
  const hasMenu = Boolean(activeCategory);

  function add(id: string) {
    setLines((prev) => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, 99) }));
  }

  function decrease(id: string) {
    setLines((prev) => {
      const next = { ...prev };
      const qty = (next[id] ?? 0) - 1;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function removeLine(id: string) {
    setLines((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validate(): Errors {
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = 'Bitte geben Sie Ihren Namen an.';
    if (!/^[\d\s+()/-]{6,}$/.test(form.phone.trim())) {
      next.phone = 'Bitte eine erreichbare Telefonnummer angeben.';
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      next.email = 'Diese E-Mail-Adresse sieht nicht gültig aus.';
    }
    if (mode === 'liefern') {
      if (form.street.trim().length < 4) next.street = 'Bitte Straße und Hausnummer angeben.';
      if (!/^\d{5}$/.test(form.zip.trim())) next.zip = 'Bitte eine 5-stellige Postleitzahl angeben.';
      else if (!DELIVERY.zips.includes(form.zip.trim())) {
        next.zip = `Wir liefern derzeit nur nach ${DELIVERY.zips.join(', ')}. Abholung ist überall möglich.`;
      }
      if (form.city.trim().length < 2) next.city = 'Bitte den Ort angeben.';
    }
    if (!form.consent) next.consent = 'Bitte bestätigen Sie die Verarbeitung Ihrer Daten.';
    if (cart.count === 0) next.cart = 'Ihr Warenkorb ist noch leer.';
    if (cart.belowMin) {
      next.cart = `Mindestbestellwert für Lieferung: ${formatPrice(DELIVERY.minOrder)}.`;
    }
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSendError('');
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      summaryRef.current?.focus();
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/sapore-grill/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          items: cart.entries.map((entry) => ({ id: entry.item.id, qty: entry.qty })),
          customer: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            street: mode === 'liefern' ? form.street.trim() : '',
            zip: mode === 'liefern' ? form.zip.trim() : '',
            city: mode === 'liefern' ? form.city.trim() : '',
          },
          time: form.time,
          note: form.note.trim(),
        }),
      });

      const data = (await response.json()) as { ok?: boolean; orderNo?: string; error?: string };
      if (!response.ok || !data.ok || !data.orderNo) {
        throw new Error(data.error || 'Die Bestellung konnte nicht übermittelt werden.');
      }

      setDone({
        orderNo: data.orderNo,
        mode,
        total: cart.total,
        eta: mode === 'liefern' ? DELIVERY.etaDelivery : DELIVERY.etaPickup,
        text: buildOrderText(),
      });
      setLines({});
      window.setTimeout(() => summaryRef.current?.scrollIntoView({ block: 'center' }), 40);
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : 'Die Bestellung konnte nicht übermittelt werden.',
      );
    } finally {
      setSending(false);
    }
  }

  /** Bestellung als Text — zum Vorlesen am Telefon oder Kopieren. */
  function buildOrderText(): string {
    const lines2 = cart.entries.map((e) => `${e.qty}× ${e.item.name}`).join('\n');
    const address =
      mode === 'liefern'
        ? `\nLieferadresse: ${form.street.trim()}, ${form.zip.trim()} ${form.city.trim()}`
        : '\nAbholung im Laden';
    const note = form.note.trim() ? `\nAnmerkung: ${form.note.trim()}` : '';
    return `Bestellung bei ${BUSINESS.name}\n\n${lines2}\n\nSumme: ${formatPrice(cart.total)}${address}\nName: ${form.name.trim()}\nTelefon: ${form.phone.trim()}\nZeit: ${form.time === 'sofort' ? 'so schnell wie möglich' : form.time}${note}`;
  }

  async function copyOrder() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const errorList = Object.entries(errors);

  if (!activeCategory || !hasMenu) return null;

  return (
    <section className={styles.section} id="speisekarte">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Speisekarte</p>
          <div className={styles.rule} />
          <h2 className={styles.h2}>Aussuchen, bestellen, genießen</h2>
          <p className={styles.lead}>
            Alles frisch zubereitet — zum Abholen an der {BUSINESS.street} oder zur Lieferung
            nach Hause. Bestellungen nehmen wir online und telefonisch entgegen.
          </p>
        </Reveal>

        {MENU_IS_PLACEHOLDER ? (
          <div className={styles.notice} role="note">
            <IconInfo className={`${styles.icon} ${styles.factIcon}`} />
            <div>
              <strong className={styles.noticeTitle}>Platzhalter-Speisekarte</strong>
              <p className={styles.noticeText}>
                Gerichte und Preise sind vorläufig und dienen nur zur Ansicht. Verbindlich
                sind die Angaben im Laden und am Telefon unter {BUSINESS.phone}. Sobald die
                echte Karte vorliegt, wird sie hier eingesetzt.
              </p>
            </div>
          </div>
        ) : null}

        <div className={styles.menuLayout} id="bestellen">
          {/* --- Karte ---------------------------------------------------- */}
          <div>
            <div className={styles.tabs} role="tablist" aria-label="Kategorien der Speisekarte">
              {MENU.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  id={`tab-${cat.id}`}
                  aria-selected={category === cat.id}
                  aria-controls={`panel-${cat.id}`}
                  className={`${styles.tab} ${category === cat.id ? styles.tabActive : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`panel-${activeCategory.id}`}
              aria-labelledby={`tab-${activeCategory.id}`}
            >
              <p className={styles.categoryNote}>{activeCategory.note}</p>

              <ul className={styles.items}>
                {activeCategory.items.map((item) => (
                  <li key={item.id} className={styles.item}>
                    <div className={styles.itemHead}>
                      <h3 className={styles.itemName}>
                        {item.name}
                        {item.tags?.map((tag) => (
                          <span
                            key={tag}
                            className={`${styles.tag} ${
                              tag === 'beliebt'
                                ? styles.tagBeliebt
                                : tag === 'vegetarisch'
                                  ? styles.tagVegetarisch
                                  : ''
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </h3>
                      <span className={styles.leader} aria-hidden="true" />
                      <span className={styles.price}>{formatPrice(item.price)}</span>
                    </div>
                    <div className={styles.itemFoot}>
                      <p className={styles.itemDesc}>{item.description}</p>
                      <button type="button" className={styles.addBtn} onClick={() => add(item.id)}>
                        <IconPlus className={styles.iconSm} />
                        <span className={styles.srOnly}>{item.name} </span>
                        Hinzufügen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* --- Warenkorb ------------------------------------------------ */}
          <div className={styles.cart} id="warenkorb">
            <div className={styles.cartHead}>
              <IconCart className={styles.icon} />
              <h3 className={styles.cartTitle}>Ihre Bestellung</h3>
              <span className={styles.cartCount} aria-live="polite">
                {cart.count}
                <span className={styles.srOnly}> Artikel im Warenkorb</span>
              </span>
            </div>

            <div className={styles.modeSwitch} role="group" aria-label="Liefern oder abholen">
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'abholen' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('abholen')}
                aria-pressed={mode === 'abholen'}
              >
                <IconBag className={styles.iconSm} />
                Abholen
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'liefern' ? styles.modeBtnActive : ''}`}
                onClick={() => setMode('liefern')}
                aria-pressed={mode === 'liefern'}
              >
                <IconMoped className={styles.iconSm} />
                Liefern
              </button>
            </div>

            {done ? (
              <div className={styles.success} ref={summaryRef} tabIndex={-1}>
                <span className={styles.successIcon}>
                  <IconCheck className={styles.icon} />
                </span>
                <h4 className={styles.successTitle}>Bestellung eingegangen</h4>
                <p className={styles.noticeText}>
                  Ihre Bestellnummer: <span className={styles.orderNo}>{done.orderNo}</span>
                </p>

                <div className={styles.summaryBox}>
                  <div className={styles.summaryRow}>
                    <span>Art</span>
                    <span>{done.mode === 'liefern' ? 'Lieferung' : 'Abholung'}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Voraussichtlich</span>
                    <span>ca. {done.eta}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Summe</span>
                    <span>{formatPrice(done.total)}</span>
                  </div>
                </div>

                <p className={styles.noticeText} style={{ marginBottom: 20 }}>
                  Wir bestätigen Ihre Bestellung telefonisch. Falls Sie in den nächsten
                  Minuten nichts hören, rufen Sie uns bitte kurz an — dann geht es sofort
                  weiter.
                </p>

                <div className={styles.successActions}>
                  <a
                    href={`tel:${BUSINESS.phoneHref}`}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    <IconPhone className={styles.icon} />
                    {BUSINESS.phone} anrufen
                  </a>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={copyOrder}>
                    <IconCopy className={styles.icon} />
                    {copied ? 'Kopiert' : 'Bestellung kopieren'}
                  </button>
                </div>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnBlock}`}
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setDone(null);
                    setErrors({});
                  }}
                >
                  Neue Bestellung starten
                </button>
              </div>
            ) : (
              <>
                {cart.entries.length === 0 ? (
                  <div className={styles.cartEmpty}>
                    <IconCart className={styles.cartEmptyIcon} />
                    <p className={styles.noticeText}>
                      Noch nichts ausgewählt. Tippen Sie links auf „Hinzufügen“.
                    </p>
                  </div>
                ) : (
                  <>
                    <ul className={styles.cartLines}>
                      {cart.entries.map(({ item, qty }) => (
                        <li key={item.id} className={styles.line}>
                          <p className={styles.lineName}>{item.name}</p>
                          <div className={styles.lineFoot}>
                            <span className={styles.linePrice}>
                              {qty} × {formatPrice(item.price)} = {formatPrice(item.price * qty)}
                            </span>
                            <div className={styles.stepper}>
                            <button
                              type="button"
                              className={styles.stepBtn}
                              onClick={() => decrease(item.id)}
                              aria-label={`Eine Portion ${item.name} entfernen`}
                            >
                              <IconMinus className={styles.iconSm} />
                            </button>
                            <span className={styles.stepValue}>{qty}</span>
                            <button
                              type="button"
                              className={styles.stepBtn}
                              onClick={() => add(item.id)}
                              aria-label={`Eine Portion ${item.name} hinzufügen`}
                            >
                              <IconPlus className={styles.iconSm} />
                            </button>
                              <button
                                type="button"
                                className={styles.stepBtn}
                                onClick={() => removeLine(item.id)}
                                aria-label={`${item.name} komplett entfernen`}
                              >
                                <IconTrash className={styles.iconSm} />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className={styles.totals}>
                      <div className={styles.totalRow}>
                        <span>Zwischensumme</span>
                        <span>{formatPrice(cart.subtotal)}</span>
                      </div>
                      {mode === 'liefern' ? (
                        <div className={styles.totalRow}>
                          <span>Liefergebühr</span>
                          <span>{cart.feeApplies ? formatPrice(cart.fee) : 'kostenlos'}</span>
                        </div>
                      ) : null}
                      <div className={`${styles.totalRow} ${styles.totalRowMain}`}>
                        <span>Gesamt</span>
                        <span>{formatPrice(cart.total)}</span>
                      </div>
                    </div>

                    {cart.belowMin ? (
                      <p className={styles.hintWarn}>
                        <IconAlert className={`${styles.iconSm}`} />
                        Noch {formatPrice(DELIVERY.minOrder - cart.subtotal)} bis zum
                        Mindestbestellwert von {formatPrice(DELIVERY.minOrder)}. Abholung ist
                        ohne Mindestwert möglich.
                      </p>
                    ) : null}

                    {mode === 'liefern' && cart.feeApplies ? (
                      <p className={styles.hintOk}>
                        <IconInfo className={styles.iconSm} />
                        Ab {formatPrice(DELIVERY.freeFrom)} liefern wir kostenfrei — es fehlen
                        noch {formatPrice(DELIVERY.freeFrom - cart.subtotal)}.
                      </p>
                    ) : null}
                  </>
                )}

                {/* --- Formular ------------------------------------------- */}
                <form className={styles.form} onSubmit={submit} noValidate>
                  {errorList.length > 0 ? (
                    <div
                      className={styles.errorSummary}
                      role="alert"
                      tabIndex={-1}
                      ref={summaryRef}
                    >
                      <p className={styles.errorSummaryTitle}>
                        Bitte prüfen Sie {errorList.length === 1 ? 'eine Angabe' : `${errorList.length} Angaben`}:
                      </p>
                      <ul className={styles.errorSummaryList}>
                        {errorList.map(([key, message]) => (
                          <li key={key}>
                            {key === 'cart' ? message : <a href={`#sapore-${key}`}>{message}</a>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="sapore-name">
                        Name
                      </label>
                      <input
                        id="sapore-name"
                        className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        autoComplete="name"
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? 'sapore-name-err' : undefined}
                        placeholder="Vor- und Nachname"
                      />
                      {errors.name ? (
                        <span className={styles.errorText} id="sapore-name-err">
                          <IconAlert className={styles.iconSm} />
                          {errors.name}
                        </span>
                      ) : null}
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="sapore-phone">
                        Telefon
                      </label>
                      <input
                        id="sapore-phone"
                        type="tel"
                        inputMode="tel"
                        className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        autoComplete="tel"
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? 'sapore-phone-err' : 'sapore-phone-help'}
                        placeholder="0170 1234567"
                      />
                      {errors.phone ? (
                        <span className={styles.errorText} id="sapore-phone-err">
                          <IconAlert className={styles.iconSm} />
                          {errors.phone}
                        </span>
                      ) : (
                        <span className={styles.helper} id="sapore-phone-help">
                          Für die Bestätigung Ihrer Bestellung.
                        </span>
                      )}
                    </div>

                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <label className={styles.label} htmlFor="sapore-email">
                        E-Mail <span className={styles.optional}>(optional)</span>
                      </label>
                      <input
                        id="sapore-email"
                        type="email"
                        className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        autoComplete="email"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'sapore-email-err' : undefined}
                        placeholder="name@beispiel.de"
                      />
                      {errors.email ? (
                        <span className={styles.errorText} id="sapore-email-err">
                          <IconAlert className={styles.iconSm} />
                          {errors.email}
                        </span>
                      ) : null}
                    </div>

                    {mode === 'liefern' ? (
                      <>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                          <label className={styles.label} htmlFor="sapore-street">
                            Straße und Hausnummer
                          </label>
                          <input
                            id="sapore-street"
                            className={`${styles.input} ${errors.street ? styles.inputError : ''}`}
                            value={form.street}
                            onChange={(e) => setForm({ ...form, street: e.target.value })}
                            autoComplete="street-address"
                            aria-invalid={Boolean(errors.street)}
                            aria-describedby={errors.street ? 'sapore-street-err' : undefined}
                            placeholder="Musterstraße 12"
                          />
                          {errors.street ? (
                            <span className={styles.errorText} id="sapore-street-err">
                              <IconAlert className={styles.iconSm} />
                              {errors.street}
                            </span>
                          ) : null}
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="sapore-zip">
                            Postleitzahl
                          </label>
                          <input
                            id="sapore-zip"
                            inputMode="numeric"
                            className={`${styles.input} ${errors.zip ? styles.inputError : ''}`}
                            value={form.zip}
                            onChange={(e) => setForm({ ...form, zip: e.target.value })}
                            autoComplete="postal-code"
                            aria-invalid={Boolean(errors.zip)}
                            aria-describedby={errors.zip ? 'sapore-zip-err' : 'sapore-zip-help'}
                            placeholder="46325"
                            maxLength={5}
                          />
                          {errors.zip ? (
                            <span className={styles.errorText} id="sapore-zip-err">
                              <IconAlert className={styles.iconSm} />
                              {errors.zip}
                            </span>
                          ) : (
                            <span className={styles.helper} id="sapore-zip-help">
                              Liefergebiet: {DELIVERY.zips.join(', ')} {BUSINESS.city}
                            </span>
                          )}
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="sapore-city">
                            Ort
                          </label>
                          <input
                            id="sapore-city"
                            className={`${styles.input} ${errors.city ? styles.inputError : ''}`}
                            value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                            autoComplete="address-level2"
                            aria-invalid={Boolean(errors.city)}
                            aria-describedby={errors.city ? 'sapore-city-err' : undefined}
                          />
                          {errors.city ? (
                            <span className={styles.errorText} id="sapore-city-err">
                              <IconAlert className={styles.iconSm} />
                              {errors.city}
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className={`${styles.field} ${styles.fieldWide}`}>
                        <span className={styles.helper}>
                          Abholung: {BUSINESS.street}, {BUSINESS.zip} {BUSINESS.city} — ca.{' '}
                          {DELIVERY.etaPickup} nach der Bestellung.
                        </span>
                      </div>
                    )}

                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="sapore-time">
                        Wunschzeit
                      </label>
                      <select
                        id="sapore-time"
                        className={styles.select}
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                      >
                        <option value="sofort">So schnell wie möglich</option>
                        {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map(
                          (slot) => (
                            <option key={slot} value={slot}>
                              {slot} Uhr
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <label className={styles.label} htmlFor="sapore-note">
                        Anmerkung <span className={styles.optional}>(optional)</span>
                      </label>
                      <textarea
                        id="sapore-note"
                        className={styles.textarea}
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        placeholder="Z. B. ohne Zwiebeln, scharfe Sauce, bitte klingeln bei …"
                        maxLength={500}
                      />
                    </div>
                  </div>

                  <label className={styles.checkboxRow} htmlFor="sapore-consent">
                    <input
                      id="sapore-consent"
                      type="checkbox"
                      className={styles.checkbox}
                      checked={form.consent}
                      onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                      aria-invalid={Boolean(errors.consent)}
                    />
                    <span>
                      Meine Daten dürfen zur Bearbeitung dieser Bestellung verwendet werden.
                      Sie werden nicht an Dritte weitergegeben.
                    </span>
                  </label>
                  {errors.consent ? (
                    <span className={styles.errorText}>
                      <IconAlert className={styles.iconSm} />
                      {errors.consent}
                    </span>
                  ) : null}

                  {sendError ? (
                    <p className={styles.hintWarn}>
                      <IconAlert className={styles.iconSm} />
                      {sendError} Bitte rufen Sie uns an: {BUSINESS.phone}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
                    disabled={sending}
                  >
                    {sending ? (
                      'Wird gesendet …'
                    ) : (
                      <>
                        <IconCheck className={styles.icon} />
                        {mode === 'liefern' ? 'Lieferung bestellen' : 'Abholung bestellen'}
                        {cart.total > 0 ? ` — ${formatPrice(cart.total)}` : ''}
                      </>
                    )}
                  </button>

                  <p className={styles.helper}>
                    Die Bestellung wird telefonisch bestätigt. Bezahlt wird bei Abholung
                    bzw. bei Lieferung.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobiler Balken: springt zum Warenkorb, zeigt Anzahl und Summe. */}
      <div className={styles.mobileBar}>
        <a href="#warenkorb" className={`${styles.btn} ${styles.btnPrimary}`}>
          <IconCart className={styles.icon} />
          Warenkorb ({cart.count})
        </a>
        <a
          href={`tel:${BUSINESS.phoneHref}`}
          className={`${styles.btn} ${styles.btnGhost} ${styles.mobileBarPhone}`}
        >
          <IconPhone className={styles.icon} />
          Anrufen
          <span className={styles.srOnly}>: {BUSINESS.phone}</span>
        </a>
      </div>
    </section>
  );
}

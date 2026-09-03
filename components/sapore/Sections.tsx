'use client';

/**
 * Sapore Grill — Seitenabschnitte ausserhalb der Bestellstrecke.
 *
 * Client-Komponenten, weil Kopfzeile (mobiles Menue), Hero und Oeffnungszeiten
 * einen Live-Status zeigen, der erst nach dem Mounten berechnet wird — sonst
 * weicht das Server-HTML von der Uhrzeit im Browser ab.
 */

import { useEffect, useRef, useState } from 'react';
import { BUSINESS, DELIVERY } from '@/lib/sapore/menu';
import styles from './sapore.module.css';
import Figure from './Figure';
import {
  BrandMark,
  IconBag,
  IconCheck,
  IconClock,
  IconClose,
  IconInstagram,
  IconLeaf,
  IconMenuBars,
  IconMoped,
  IconPhone,
  IconPin,
} from './Icons';

const NAV = [
  { href: '#speisekarte', label: 'Speisekarte' },
  { href: '#spezialitaeten', label: 'Spezialitäten' },
  { href: '#ablauf', label: 'Bestellen' },
  { href: '#zeiten', label: 'Öffnungszeiten' },
  { href: '#kontakt', label: 'Kontakt' },
];

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Ist jetzt geoeffnet? Taeglich 11–22 Uhr, in lokaler Zeit gerechnet. */
function computeOpen(now: Date): { open: boolean; label: string } {
  const hour = now.getHours() + now.getMinutes() / 60;
  const open = hour >= BUSINESS.opensAt && hour < BUSINESS.closesAt;
  if (open) {
    const closesIn = Math.round((BUSINESS.closesAt - hour) * 60);
    return {
      open: true,
      label: closesIn <= 60 ? `Geöffnet — noch ${closesIn} Minuten` : 'Jetzt geöffnet',
    };
  }
  return {
    open: false,
    label: hour < BUSINESS.opensAt ? `Öffnet um ${BUSINESS.opensAt}:00 Uhr` : 'Für heute geschlossen',
  };
}

/**
 * Zerlegt eine Zeile in Woerter, damit sie beim Laden gestaffelt aufblendet.
 * Woerter statt Buchstaben: der Skill raet von zeichenweiser Animation bei
 * laengeren Zeilen ab (ein Element je Zeichen blaeht das Dokument auf), und
 * deutsche Komposita blieben dabei schlecht lesbar. Unter
 * `prefers-reduced-motion` steht alles sofort still und sichtbar.
 */
function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={styles.word}
          style={{ animationDelay: `${delay + index * 0.055}s` }}
        >
          {word}
          {index < text.split(' ').length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </>
  );
}

/** Statuszeile, die Hero und Oeffnungszeiten teilen. */
export function OpenStatus() {
  const [state, setState] = useState<{ open: boolean; label: string } | null>(null);

  useEffect(() => {
    const tick = () => setState(computeOpen(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!state) {
    return (
      <span>
        Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr
      </span>
    );
  }

  return (
    <span className={state.open ? styles.statusOpen : styles.statusClosed}>
      <span className={styles.dot} />
      {state.label}
    </span>
  );
}

/** Blendet Inhalte beim Scrollen ein; respektiert `prefers-reduced-motion`. */
export function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.reveal} ${shown ? styles.revealIn : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.utility}>
        <div className={styles.shell}>
          <div className={styles.utilityInner}>
            <span className={styles.utilityItem}>
              <IconClock className={styles.iconSm} />
              Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr
            </span>
            <span className={`${styles.utilitySep} ${styles.utilityAddress}`} aria-hidden="true">
              ·
            </span>
            <span className={`${styles.utilityItem} ${styles.utilityAddress}`}>
              <IconPin className={styles.iconSm} />
              {BUSINESS.street}, {BUSINESS.zip} {BUSINESS.city}
            </span>
            <span className={styles.utilitySep} aria-hidden="true">
              ·
            </span>
            <a href={`tel:${BUSINESS.phoneHref}`} className={styles.utilityItem}>
              <IconPhone className={styles.iconSm} />
              {BUSINESS.phone}
            </a>
          </div>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.shell}>
          <div className={styles.headerInner}>
            <a href="#top" className={styles.brand}>
              <BrandMark className={styles.brandMark} />
              <span className={styles.brandText}>
                <span className={styles.brandName}>{BUSINESS.name}</span>
                <span className={styles.brandSub}>Döner · Pizza · Borken</span>
              </span>
            </a>

            <nav className={styles.nav} aria-label="Hauptnavigation">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className={styles.headerActions}>
              <a
                href="#speisekarte"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.headerPhone}`}
              >
                Online bestellen
              </a>
              <button
                type="button"
                className={styles.burger}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="sapore-mobile-nav"
                aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
              >
                {open ? <IconClose className={styles.icon} /> : <IconMenuBars className={styles.icon} />}
              </button>
            </div>
          </div>

          {open ? (
            <nav id="sapore-mobile-nav" className={styles.mobileNav} aria-label="Menü">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={styles.mobileNavLink}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href={`tel:${BUSINESS.phoneHref}`}
                className={styles.mobileNavLink}
                onClick={() => setOpen(false)}
              >
                Anrufen: {BUSINESS.phone}
              </a>
            </nav>
          ) : null}
        </div>
      </header>
    </>
  );
}

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <div className={styles.shell}>
        <div className={styles.heroInner}>
          <div>
            <p className={styles.heroStatus}>
              <OpenStatus />
              <span>Seit September in Borken</span>
            </p>

            <h1 className={styles.heroTitle}>
              <Words text="Vom Spieß." />
              <em>
                <Words text="Nicht aus der Presse." delay={0.2} />
              </em>
            </h1>

            <p className={styles.heroText}>
              Steakdöner, Pizza und Imbiss in Borken. Bei Sapore Grill kommt ausschließlich
              Fleisch vom Jungbullen auf den Spieß — kein Hack, nichts Gepresstes. Dazu
              knusprige Pizza aus dem Ofen, täglich frisch geschnittene Salate und deftige
              Imbiss-Teller. Zum Abholen oder zur Lieferung.
            </p>

            <div className={styles.heroCtas}>
              <a href="#speisekarte" className={`${styles.btn} ${styles.btnPrimary}`}>
                <IconBag className={styles.icon} />
                Speisekarte &amp; Bestellung
              </a>
              <a href={`tel:${BUSINESS.phoneHref}`} className={`${styles.btn} ${styles.btnGhost}`}>
                <IconPhone className={styles.icon} />
                {BUSINESS.phone}
              </a>
            </div>

            <ul className={styles.heroFacts}>
              {[
                '100 % Fleisch vom Jungbullen — kein Hack, kein Gepresstes',
                'Täglich frisch geschnittenes Gemüse und Salate',
                'Sieben Tage die Woche durchgehend warme Küche',
                'Alle Speisen auch zum Mitnehmen',
              ].map((fact) => (
                <li key={fact} className={styles.fact}>
                  <IconCheck className={`${styles.iconSm} ${styles.factIcon}`} />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Figure
              src="/sapore/hero.jpg"
              alt="Frisch zubereiteter Steakdöner vom Jungbullen bei Sapore Grill in Borken"
              need="Ihr bestes Produktfoto: ein frisch belegter Steakdöner, seitlich fotografiert"
              hint="Hochformat, mindestens 1200 × 1500 px"
              ratio="4 / 5"
              priority
            />

            <div className={styles.heroCard} style={{ marginTop: 24 }}>
              <h2 className={styles.heroCardTitle}>Auf einen Blick</h2>
              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span className={styles.infoIcon}>
                    <IconPin className={styles.iconSm} />
                  </span>
                  <div>
                    <div className={styles.infoLabel}>Adresse</div>
                    <span className={styles.infoValue}>{BUSINESS.street}</span>
                    <div className={styles.infoNote}>
                      {BUSINESS.zip} {BUSINESS.city}
                    </div>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoIcon}>
                    <IconClock className={styles.iconSm} />
                  </span>
                  <div>
                    <div className={styles.infoLabel}>Öffnungszeiten</div>
                    <span className={styles.infoValue}>Montag bis Sonntag</span>
                    <div className={styles.infoNote}>
                      {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr, durchgehend warm
                    </div>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoIcon}>
                    <IconMoped className={styles.iconSm} />
                  </span>
                  <div>
                    <div className={styles.infoLabel}>Lieferung &amp; Abholung</div>
                    <span className={styles.infoValue}>Lieferung ca. {DELIVERY.etaDelivery}</span>
                    <div className={styles.infoNote}>Abholung ca. {DELIVERY.etaPickup}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  const items = [
    { value: '100 %', label: 'Fleisch vom Jungbullen, kein Hack' },
    { value: 'Täglich frisch', label: 'Gemüse und Salate am selben Tag geschnitten' },
    { value: '11 – 22 Uhr', label: 'Sieben Tage die Woche geöffnet' },
    { value: 'Liefern & Abholen', label: 'Online bestellen oder telefonisch' },
  ];

  return (
    <div className={styles.trust}>
      <div className={styles.shell}>
        <div className={styles.trustGrid}>
          {items.map((item) => (
            <div key={item.value} className={styles.trustItem}>
              <span className={styles.trustValue}>{item.value}</span>
              <span className={styles.trustLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Specials() {
  return (
    <section className={styles.section} id="spezialitaeten">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Unsere Spezialitäten</p>
          <div className={styles.rule} />
          <h2 className={styles.h2}>Steakdöner und Gemüse Kebap</h2>
          <p className={styles.lead}>
            Zwei Gerichte stehen für das, wofür Sapore Grill steht: ehrliche Zutaten,
            sauber verarbeitet, jeden Tag neu.
          </p>
        </Reveal>

        <div className={styles.specialGrid}>
          <Reveal>
            <article className={styles.special}>
              <Figure
                className={styles.specialFigure}
                src="/sapore/steakdoener.jpg"
                alt="Steakdöner vom Jungbullen mit Salat, Tomate und Zwiebeln im Fladenbrot"
                need="Steakdöner im Anschnitt — Fleisch und Salat gut sichtbar"
                ratio="3 / 2"
              />
              <span className={styles.specialTag}>Der Klassiker</span>
              <h3 className={styles.specialTitle}>Steakdöner vom Jungbullen</h3>
              <p className={styles.specialText}>
                Echte Steakstreifen statt Formfleisch: am Spieß gegrillt, frisch
                aufgeschnitten und mit Salat, Tomate und Zwiebeln im Fladenbrot serviert.
              </p>
              <ul className={styles.specialList}>
                {[
                  '100 % Fleisch vom Jungbullen',
                  'Kein Hack, nichts Gepresstes',
                  'Sauce nach Wahl, auch scharf',
                ].map((li) => (
                  <li key={li}>
                    <IconCheck className={`${styles.iconSm} ${styles.check}`} />
                    {li}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal>
            <article className={styles.special}>
              <Figure
                className={styles.specialFigure}
                src="/sapore/gemuese-kebap.jpg"
                alt="Gemüse Kebap mit gegrilltem Gemüse, Grillkäse und Kräutersauce"
                need="Gemüse Kebap mit sichtbarem Grillgemüse und Käse"
                ratio="3 / 2"
              />
              <span className={styles.specialTag}>Vegetarisch</span>
              <h3 className={styles.specialTitle}>Gemüse Kebap</h3>
              <p className={styles.specialText}>
                Gegrilltes Gemüse, Grillkäse und Kräutersauce im knusprigen Fladen — die
                fleischlose Alternative, die tatsächlich satt macht.
              </p>
              <ul className={styles.specialList}>
                {[
                  'Frisches Grillgemüse der Saison',
                  'Täglich frisch geschnitten',
                  'Auch als Dürüm erhältlich',
                ].map((li) => (
                  <li key={li}>
                    <IconLeaf className={`${styles.iconSm} ${styles.check}`} />
                    {li}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Der Leitspruch des Betriebs — die einzige Stelle mit Serifenschrift. */
export function Quote() {
  return (
    <section className={styles.quoteBlock}>
      <div className={styles.shell}>
        <Reveal>
          <blockquote className={styles.quote}>
            <p className={styles.quoteText}>
              „Frisch. Lecker. <span>Qualität.</span>“
            </p>
            <span className={styles.quoteBy}>Unser Versprechen, jeden Tag</span>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

export function Gallery() {
  const shots = [
    {
      src: '/sapore/galerie-pizza.jpg',
      alt: 'Frisch gebackene Pizza mit Tomatensauce, Mozzarella und Basilikum',
      need: 'Pizza aus dem Ofen, von oben fotografiert',
    },
    {
      src: '/sapore/galerie-salat.jpg',
      alt: 'Frischer gemischter Salat mit Feta, Tomaten, Gurken und Oliven',
      need: 'Salatschale, von schräg oben',
    },
    {
      src: '/sapore/galerie-imbiss.jpg',
      alt: 'Imbiss-Teller mit Currywurst, Pommes Frites und Gyros mit Tzatziki',
      need: 'Imbiss-Teller komplett angerichtet',
    },
    {
      src: '/sapore/galerie-laden.jpg',
      alt: 'Verkaufsraum von Sapore Grill an der Johann-Walling-Straße in Borken',
      need: 'Innenaufnahme oder Außenansicht des Ladens',
    },
  ];

  return (
    <section className={`${styles.section} ${styles.sectionAlt}`} id="eindruecke">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Eindrücke</p>
          <div className={styles.rule} />
          <h2 className={styles.h2}>Ein Blick auf unsere Küche</h2>
          <p className={styles.lead}>
            Pizza aus dem Ofen, frische Salate, deftige Teller — und der Laden an der{' '}
            {BUSINESS.street}.
          </p>
        </Reveal>

        <Reveal>
          <div className={styles.galleryGrid}>
            {shots.map((shot) => (
              <Figure
                key={shot.src}
                src={shot.src}
                alt={shot.alt}
                need={shot.need}
                hint="Quadratisch, mindestens 1000 × 1000 px"
                ratio="1 / 1"
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Steps() {
  const steps = [
    {
      title: 'Gerichte auswählen',
      text: 'Kategorie wählen und Gerichte in den Warenkorb legen. Mengen passen Sie dort jederzeit an.',
    },
    {
      title: 'Liefern oder abholen',
      text: `Abholung ist ohne Mindestbestellwert möglich. Für die Lieferung gilt ein Mindestbestellwert von ${DELIVERY.minOrder.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}.`,
    },
    {
      title: 'Bestellung abschicken',
      text: 'Kontaktdaten eintragen und absenden. Wir bestätigen telefonisch und beginnen mit der Zubereitung.',
    },
  ];

  return (
    <section className={styles.section} id="ablauf">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>So bestellen Sie</p>
          <div className={styles.rule} />
          <h2 className={styles.h2}>In drei Schritten zum Essen</h2>
          <p className={styles.lead}>
            Online in etwa einer Minute bestellt — oder klassisch per Telefon unter{' '}
            {BUSINESS.phone}.
          </p>
        </Reveal>

        <div className={styles.steps}>
          {steps.map((step, index) => (
            <Reveal key={step.title}>
              <article className={styles.step}>
                <span className={styles.stepNum}>Schritt {index + 1}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Hours() {
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => setToday(new Date().getDay()), []);

  return (
    <section className={`${styles.section} ${styles.sectionAlt}`} id="zeiten">
      <div className={styles.shell}>
        <div className={styles.hoursGrid}>
          <Reveal>
            <p className={styles.eyebrow}>Öffnungszeiten</p>
            <div className={styles.rule} />
            <h2 className={styles.h2}>Sieben Tage die Woche für Sie da</h2>
            <p className={styles.lead}>
              Durchgehend warme Küche von {BUSINESS.opensAt}:00 bis {BUSINESS.closesAt}:00 Uhr,
              auch an Wochenenden und Feiertagen. Kurzfristige Änderungen geben wir auf
              Instagram bekannt.
            </p>
            <p className={styles.heroStatus} style={{ marginTop: 24, marginBottom: 0 }}>
              <OpenStatus />
            </p>
          </Reveal>

          <Reveal>
            <div className={styles.hoursTable}>
              {WEEKDAYS.map((day, index) => (
                <div
                  key={day}
                  className={`${styles.hourRow} ${today === index ? styles.hourRowToday : ''}`}
                >
                  <span className={styles.hourDay}>
                    {day}
                    {today === index ? <span className={styles.srOnly}> (heute)</span> : null}
                  </span>
                  <span>
                    {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  const mapQuery = encodeURIComponent(`${BUSINESS.street}, ${BUSINESS.zip} ${BUSINESS.city}`);

  return (
    <section className={styles.section} id="kontakt">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Kontakt</p>
          <div className={styles.rule} />
          <h2 className={styles.h2}>So finden Sie uns</h2>
          <p className={styles.lead}>
            Sapore Grill liegt an der {BUSINESS.street} in {BUSINESS.city}. Kommen Sie vorbei,
            rufen Sie an oder folgen Sie uns auf Instagram.
          </p>
        </Reveal>

        <div className={`${styles.hoursGrid} ${styles.contactGrid}`}>
          <Reveal>
            <div className={styles.contactCards}>
              <a
                className={styles.contactCard}
                href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.infoIcon}>
                  <IconPin className={styles.iconSm} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Adresse</div>
                  <span className={styles.infoValue}>{BUSINESS.street}</span>
                  <div className={styles.infoNote}>
                    {BUSINESS.zip} {BUSINESS.city} — Route planen
                  </div>
                </div>
              </a>

              <a className={styles.contactCard} href={`tel:${BUSINESS.phoneHref}`}>
                <span className={styles.infoIcon}>
                  <IconPhone className={styles.iconSm} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Telefon</div>
                  <span className={styles.infoValue}>{BUSINESS.phone}</span>
                  <div className={styles.infoNote}>
                    Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr
                  </div>
                </div>
              </a>

              <a
                className={styles.contactCard}
                href={BUSINESS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.infoIcon}>
                  <IconInstagram className={styles.iconSm} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Instagram</div>
                  <span className={styles.infoValue}>@{BUSINESS.instagram}</span>
                  <div className={styles.infoNote}>Angebote und Neuigkeiten</div>
                </div>
              </a>
            </div>
          </Reveal>

          <Reveal>
            <iframe
              className={styles.mapFrame}
              title={`Karte: ${BUSINESS.name}, ${BUSINESS.street}, ${BUSINESS.zip} ${BUSINESS.city}`}
              src="https://www.openstreetmap.org/export/embed.html?bbox=6.845%2C51.836%2C6.878%2C51.851&layer=mapnik&marker=51.8437%2C6.8608"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <p className={styles.figureCaption}>
              Kartenausschnitt {BUSINESS.city}. Für die Routenplanung auf die Adresse links
              tippen.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={styles.section}>
      <div className={styles.shell}>
        <Reveal>
          <div className={styles.finalCta}>
            <h2 className={styles.finalTitle}>
              Hunger?
              <em>Wir legen auf.</em>
            </h2>
            <p className={styles.finalText}>
              Täglich von {BUSINESS.opensAt}:00 bis {BUSINESS.closesAt}:00 Uhr für Sie da —
              online bestellen oder einfach anrufen.
            </p>
            <div className={styles.finalCtas}>
              <a href="#speisekarte" className={`${styles.btn} ${styles.btnOnDark}`}>
                <IconBag className={styles.icon} />
                Zur Speisekarte
              </a>
              <a
                href={`tel:${BUSINESS.phoneHref}`}
                className={`${styles.btn} ${styles.btnGhostOnDark}`}
              >
                <IconPhone className={styles.icon} />
                {BUSINESS.phone}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.footerGrid}>
          <div>
            <a href="#top" className={styles.brand} style={{ marginBottom: 16 }}>
              <BrandMark className={styles.brandMark} />
              <span className={styles.brandText}>
                <span className={styles.brandName}>{BUSINESS.name}</span>
                <span className={styles.brandSub}>{BUSINESS.tagline}</span>
              </span>
            </a>
            <p className={styles.noticeText}>
              Döner, Pizza, Imbiss und Salate in {BUSINESS.city}. Täglich frisch zubereitet —
              zum Abholen oder zur Lieferung nach Hause.
            </p>
          </div>

          <div>
            <h2 className={styles.footerTitle}>Kontakt</h2>
            <ul className={styles.footerList}>
              <li>{BUSINESS.street}</li>
              <li>
                {BUSINESS.zip} {BUSINESS.city}
              </li>
              <li>
                <a className={styles.footerLink} href={`tel:${BUSINESS.phoneHref}`}>
                  {BUSINESS.phone}
                </a>
              </li>
              <li>
                <a
                  className={styles.footerLink}
                  href={BUSINESS.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{BUSINESS.instagram}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className={styles.footerTitle}>Seite</h2>
            <ul className={styles.footerList}>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a className={styles.footerLink} href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} {BUSINESS.name}, {BUSINESS.city}
          </span>
          <span>
            Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr geöffnet
          </span>
        </div>
      </div>
    </footer>
  );
}

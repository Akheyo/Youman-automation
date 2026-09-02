'use client';

/**
 * Sapore Grill — Seitenabschnitte ausserhalb der Bestellstrecke.
 *
 * Bewusst als Client-Komponenten: Kopfzeile (mobiles Menue), Hero und
 * Oeffnungszeiten zeigen einen Live-Status ("Jetzt geoeffnet"), der erst nach
 * dem Mounten berechnet wird — sonst weicht der Server-HTML von der Uhrzeit im
 * Browser ab (Hydration-Mismatch).
 */

import { useEffect, useRef, useState } from 'react';
import { BUSINESS, DELIVERY } from '@/lib/sapore/menu';
import styles from './sapore.module.css';
import {
  BrandMark,
  IconBag,
  IconCheck,
  IconClock,
  IconClose,
  IconFlame,
  IconInstagram,
  IconLeaf,
  IconMenuBars,
  IconMoped,
  IconPhone,
  IconPin,
} from './Icons';

const NAV = [
  { href: '#speisekarte', label: 'Speisekarte' },
  { href: '#bestellen', label: 'Bestellen' },
  { href: '#ablauf', label: 'So geht’s' },
  { href: '#zeiten', label: 'Öffnungszeiten' },
  { href: '#kontakt', label: 'Kontakt' },
];

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Ist jetzt geoeffnet? Taeglich 11–22 Uhr, gerechnet in lokaler Zeit. */
function computeOpen(now: Date): { open: boolean; label: string } {
  const hour = now.getHours() + now.getMinutes() / 60;
  const open = hour >= BUSINESS.opensAt && hour < BUSINESS.closesAt;
  if (open) {
    const closesIn = Math.round((BUSINESS.closesAt - hour) * 60);
    return {
      open: true,
      label: closesIn <= 60 ? `Jetzt geöffnet — noch ${closesIn} Min.` : 'Jetzt geöffnet',
    };
  }
  return {
    open: false,
    label: hour < BUSINESS.opensAt ? `Öffnet um ${BUSINESS.opensAt}:00 Uhr` : 'Für heute geschlossen',
  };
}

/** Kleiner Statuspunkt, den Hero, Zeiten-Abschnitt und Fusszeile teilen. */
export function OpenBadge() {
  const [state, setState] = useState<{ open: boolean; label: string } | null>(null);

  useEffect(() => {
    const tick = () => setState(computeOpen(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!state) {
    return (
      <span className={styles.badge}>
        <IconClock className={styles.iconSm} />
        Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr
      </span>
    );
  }

  return (
    <span className={`${styles.badge} ${state.open ? styles.badgeOpen : styles.badgeClosed}`}>
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
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
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
    <header className={styles.header}>
      <div className={styles.shell}>
        <div className={styles.headerInner}>
          <a href="#top" className={styles.brand}>
            <BrandMark className={styles.brandMark} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>{BUSINESS.name}</span>
              <span className={styles.brandSub}>Borken</span>
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
              href={`tel:${BUSINESS.phoneHref}`}
              className={`${styles.btn} ${styles.btnPrimary} ${styles.headerPhone}`}
            >
              <IconPhone className={styles.icon} />
              {BUSINESS.phone}
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
  );
}

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroGrain} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.heroInner}>
          <div>
            <div className={styles.heroBadges}>
              <OpenBadge />
              <span className={styles.badge}>
                <IconFlame className={styles.iconSm} />
                Neu eröffnet in Borken
              </span>
            </div>

            <h1 className={styles.heroTitle}>
              Ihr neuer
              <em>Genuss-Hotspot</em>
            </h1>

            <p className={styles.heroText}>
              Steakdöner vom Jungbullen, Gemüse Kebap, knusprige Pizza, frische Salate und
              deftige Imbiss-Teller. Täglich frisch zubereitet — zum Abholen oder direkt zu
              Ihnen nach Hause geliefert.
            </p>

            <div className={styles.heroCtas}>
              <a href="#speisekarte" className={`${styles.btn} ${styles.btnPrimary}`}>
                <IconBag className={styles.icon} />
                Jetzt online bestellen
              </a>
              <a href={`tel:${BUSINESS.phoneHref}`} className={`${styles.btn} ${styles.btnGhost}`}>
                <IconPhone className={styles.icon} />
                {BUSINESS.phone}
              </a>
            </div>

            <ul className={styles.heroFacts}>
              {[
                '100 % Jungbullen-Fleisch',
                'Kein Hack, kein Gepresstes',
                'Täglich frisch geschnitten',
                'Alles auch zum Mitnehmen',
              ].map((fact) => (
                <li key={fact} className={styles.fact}>
                  <IconCheck className={`${styles.iconSm} ${styles.factIcon}`} />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.heroCard}>
            <h2 className={styles.heroCardTitle}>Auf einen Blick</h2>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoIcon}>
                  <IconPin className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Adresse</div>
                  <div className={styles.infoValue}>{BUSINESS.street}</div>
                  <div className={styles.infoNote}>
                    {BUSINESS.zip} {BUSINESS.city}
                  </div>
                </div>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoIcon}>
                  <IconClock className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Öffnungszeiten</div>
                  <div className={styles.infoValue}>Montag – Sonntag</div>
                  <div className={styles.infoNote}>
                    {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr, durchgehend warm
                  </div>
                </div>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoIcon}>
                  <IconPhone className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Telefon</div>
                  <a href={`tel:${BUSINESS.phoneHref}`} className={styles.infoValue}>
                    {BUSINESS.phone}
                  </a>
                  <div className={styles.infoNote}>Bestellung auch telefonisch</div>
                </div>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoIcon}>
                  <IconMoped className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Lieferung</div>
                  <div className={styles.infoValue}>Ca. {DELIVERY.etaDelivery}</div>
                  <div className={styles.infoNote}>Abholung ca. {DELIVERY.etaPickup}</div>
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
    { value: '100 %', label: 'Jungbullen-Fleisch' },
    { value: 'Täglich', label: 'frische Zubereitung' },
    { value: '11–22', label: 'Uhr, 7 Tage die Woche' },
    { value: 'Liefern', label: '& Abholen möglich' },
  ];

  return (
    <div className={styles.trust}>
      <div className={styles.shell}>
        <div className={styles.trustGrid}>
          {items.map((item) => (
            <div key={item.label} className={styles.trustItem}>
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
          <p className={styles.eyebrow}>Unsere Aushängeschilder</p>
          <h2 className={styles.h2}>Steakdöner &amp; Gemüse Kebap</h2>
          <p className={styles.lead}>
            Zwei Spezialitäten, für die sich der Weg lohnt — beide frisch am Spieß und im
            Fladen, wie es sein soll.
          </p>
        </Reveal>

        <div className={styles.specialGrid}>
          <Reveal>
            <article className={styles.special}>
              <span className={styles.specialTag}>Der Klassiker</span>
              <h3 className={styles.specialTitle}>Steakdöner vom Jungbullen</h3>
              <p className={styles.specialText}>
                Echte Steakstreifen statt Formfleisch — am Spieß gegrillt, saftig
                aufgeschnitten und mit frischem Salat, Tomate und Zwiebel serviert.
              </p>
              <ul className={styles.specialList}>
                {['100 % Fleisch vom Jungbullen', 'Kein Hack, kein Gepresstes', 'Saucen nach Wahl'].map((li) => (
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
              <span className={styles.specialTag}>Fleischlos glücklich</span>
              <h3 className={styles.specialTitle}>Gemüse Kebap</h3>
              <p className={styles.specialText}>
                Gegrilltes Gemüse, Grillkäse und Kräutersauce im knusprigen Fladen — die
                vegetarische Alternative, die satt macht.
              </p>
              <ul className={styles.specialList}>
                {['Frisches Grillgemüse', 'Täglich frisch geschnitten', 'Auch als Dürüm möglich'].map((li) => (
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

export function Steps() {
  const steps = [
    {
      title: 'Gerichte auswählen',
      text: 'Kategorie antippen, Gerichte in den Warenkorb legen. Die Menge passen Sie direkt im Warenkorb an.',
    },
    {
      title: 'Liefern oder abholen',
      text: `Abholung ist ab dem ersten Euro möglich. Für die Lieferung gilt ein Mindestbestellwert von ${DELIVERY.minOrder.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}.`,
    },
    {
      title: 'Bestellung abschicken',
      text: 'Kontaktdaten eintragen, absenden — wir bestätigen Ihre Bestellung telefonisch und legen los.',
    },
  ];

  return (
    <section className={`${styles.section} ${styles.sectionAlt}`} id="ablauf">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>So bestellen Sie</p>
          <h2 className={styles.h2}>In drei Schritten zum Essen</h2>
          <p className={styles.lead}>
            Online in einer Minute bestellt — oder ganz klassisch per Telefon unter{' '}
            {BUSINESS.phone}.
          </p>
        </Reveal>

        <div className={styles.steps}>
          {steps.map((step, index) => (
            <Reveal key={step.title}>
              <article className={styles.step}>
                <span className={styles.stepNum}>{index + 1}</span>
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
    <section className={styles.section} id="zeiten">
      <div className={styles.shell}>
        <div className={styles.hoursGrid}>
          <Reveal>
            <p className={styles.eyebrow}>Immer für Sie da</p>
            <h2 className={styles.h2}>Öffnungszeiten</h2>
            <p className={styles.lead}>
              Sieben Tage die Woche, durchgehend warme Küche von {BUSINESS.opensAt}:00 bis{' '}
              {BUSINESS.closesAt}:00 Uhr. Auch an Feiertagen — kurzfristige Änderungen geben
              wir auf Instagram bekannt.
            </p>
            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <OpenBadge />
            </div>
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
  const mapQuery = encodeURIComponent(
    `${BUSINESS.street}, ${BUSINESS.zip} ${BUSINESS.city}`,
  );

  return (
    <section className={`${styles.section} ${styles.sectionAlt}`} id="kontakt">
      <div className={styles.shell}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Besuchen Sie uns</p>
          <h2 className={styles.h2}>Kontakt &amp; Anfahrt</h2>
          <p className={styles.lead}>
            Mitten in Borken an der {BUSINESS.street} — kommen Sie vorbei, rufen Sie an oder
            folgen Sie uns auf Instagram.
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
                  <IconPin className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Adresse</div>
                  <div className={styles.infoValue}>{BUSINESS.street}</div>
                  <div className={styles.infoNote}>
                    {BUSINESS.zip} {BUSINESS.city} — Route planen
                  </div>
                </div>
              </a>

              <a className={styles.contactCard} href={`tel:${BUSINESS.phoneHref}`}>
                <span className={styles.infoIcon}>
                  <IconPhone className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Telefon</div>
                  <div className={styles.infoValue}>{BUSINESS.phone}</div>
                  <div className={styles.infoNote}>Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr</div>
                </div>
              </a>

              <a
                className={styles.contactCard}
                href={BUSINESS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.infoIcon}>
                  <IconInstagram className={styles.icon} />
                </span>
                <div>
                  <div className={styles.infoLabel}>Instagram</div>
                  <div className={styles.infoValue}>@{BUSINESS.instagram}</div>
                  <div className={styles.infoNote}>Aktuelle Angebote und Neuigkeiten</div>
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
            <h2 className={styles.finalTitle}>Hunger? Wir grillen schon.</h2>
            <p className={styles.finalText}>
              Frisch, lecker, Qualität — täglich von {BUSINESS.opensAt}:00 bis{' '}
              {BUSINESS.closesAt}:00 Uhr. Online bestellen oder einfach anrufen.
            </p>
            <div className={styles.finalCtas}>
              <a href="#speisekarte" className={`${styles.btn} ${styles.btnGold}`}>
                <IconBag className={styles.icon} />
                Zur Speisekarte
              </a>
              <a href={`tel:${BUSINESS.phoneHref}`} className={`${styles.btn} ${styles.btnGhost}`}>
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
                <span className={styles.brandSub}>{BUSINESS.claim}</span>
              </span>
            </a>
            <p className={styles.noticeText}>
              {BUSINESS.tagline}. Täglich frisch zubereitet in Borken — zum Abholen oder
              zur Lieferung nach Hause.
            </p>
          </div>

          <div>
            <h3 className={styles.footerTitle}>Kontakt</h3>
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
            <h3 className={styles.footerTitle}>Seite</h3>
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
          <span>Täglich {BUSINESS.opensAt}:00 – {BUSINESS.closesAt}:00 Uhr geöffnet</span>
        </div>
      </div>
    </footer>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './start.module.css';

export const metadata: Metadata = {
  title: 'Felix — dein KI-Vertriebsteam | Youman Automation',
  description:
    'Felix findet passende Firmen, Anna analysiert sie, Paul schreibt & sendet den Pitch. Automatisierte B2B-Neukundengewinnung – auf Deutsch, DSGVO-konform, mit Freigabe vor jedem Versand.',
};

/* ---- kleine Inline-Icons (sauberer als Emojis) ---- */
const Icon = {
  search: <path d="M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />,
  doc: <path d="M6 2h8l4 4v16H6V2zm7 1.5V7h3.5L13 3.5zM8 11h8v2H8v-2zm0 4h8v2H8v-2z" />,
  mail: <path d="M3 5h18v14H3V5zm2 2v.4l7 4.3 7-4.3V7H5zm14 2.7-7 4.3-7-4.3V17h14V9.7z" />,
  shield: <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm0 2.2 6 2.2V11c0 3.9-2.5 7.6-6 8.8-3.5-1.2-6-4.9-6-8.8V6.4l6-2.2z" />,
  bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
  globe: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3a15 15 0 0 0-1-4.6A8 8 0 0 1 18.9 11zM12 4c.8 1 1.6 2.8 1.9 5h-3.8C10.4 6.8 11.2 5 12 5zm-3.9.4A15 15 0 0 0 7.1 11h-3a8 8 0 0 1 4-6.6zM4.1 13h3a15 15 0 0 0 1 4.6A8 8 0 0 1 4.1 13zM12 20c-.8-1-1.6-2.8-1.9-5h3.8c-.3 2.2-1.1 4-1.9 5zm1.9-.4a15 15 0 0 0 1-4.6h3a8 8 0 0 1-4 4.6z" />,
  check: <path d="m9.5 17-5-5 1.4-1.4 3.6 3.6 8.1-8.1L19 7.5 9.5 17z" />,
  clock: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6l5 3 .9-1.6-4-2.4V7h-1.9z" />,
};

function Svg({ d, className }: { d: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {d}
    </svg>
  );
}

const STATS = [
  { v: '∞', l: 'Firmen aus echten Quellen' },
  { v: '3', l: 'KI-Spezialisten im Team' },
  { v: '100%', l: 'DSGVO-konform & auf Deutsch' },
  { v: '0 €', l: 'zum Starten – keine Karte' },
];

const FEATURES = [
  {
    img: '/team/felix.png',
    tag: 'Felix · Lead-Scout',
    title: 'Findet deine nächsten Kunden – in Sekunden',
    text: 'Sag Felix Region und Branche. Er liefert echte Betriebe samt Adresse, Telefon und Website-Status aus Google Places. Auf Wunsch gezielt Firmen ohne Website – die heißesten Leads.',
    points: ['Echte Daten, keine Erfindungen', 'Filter „ohne Website" für Kaltakquise', 'Ganz Deutschland abgedeckt'],
  },
  {
    img: '/team/anna.png',
    tag: 'Anna · Analystin',
    title: 'Versteht jede Firma, bevor du sie ansprichst',
    text: 'Anna liest die Website inklusive Impressum, findet die Kontakt-E-Mail und schätzt das Unternehmen genau nach deiner Vorgabe ein – damit dein Pitch ins Schwarze trifft.',
    points: ['Kontakt-E-Mail automatisch gefunden', 'Analyse nach deiner Zielsetzung', 'Spart das mühsame Recherchieren'],
  },
  {
    img: '/team/paul.png',
    tag: 'Paul · Pitch & Versand',
    title: 'Schreibt den Pitch – du behältst die Kontrolle',
    text: 'Paul formuliert eine persönliche Verkaufs-E-Mail, zeigt sie dir als Entwurf und versendet erst nach deiner Freigabe. Kein Spam, kein Risiko – volle Kontrolle.',
    points: ['Persönliche Texte statt Massenmail', 'Freigabe vor jedem Versand', 'Versand über deine eigene Adresse'],
  },
];

const BENEFITS = [
  { i: Icon.globe, t: 'Auf Deutsch', d: 'Du chattest ganz normal auf Deutsch – keine Vorlagen, keine Technik.' },
  { i: Icon.shield, t: 'DSGVO-konform', d: 'Freigabe vor jedem Versand, Daten bleiben unter deiner Kontrolle.' },
  { i: Icon.bolt, t: 'Blitzschnell', d: 'Recherche, die früher Stunden dauerte, in wenigen Sekunden.' },
  { i: Icon.check, t: 'Echte Firmendaten', d: 'Aus Google Places & OpenStreetMap – nie erfundene Adressen.' },
  { i: Icon.clock, t: 'Rund um die Uhr', d: 'Dein Team arbeitet, wann du willst – auch nachts und am Wochenende.' },
  { i: Icon.mail, t: 'Eigener Absender', d: 'Mails gehen über deine Domain – professionell und vertrauenswürdig.' },
];

const STEPS = [
  { n: '1', t: 'Suchen', d: '„Restaurants in Borken ohne Website" – Felix liefert die Leads.' },
  { n: '2', t: 'Analysieren', d: 'Anna prüft die Firma und holt die E-Mail-Adresse.' },
  { n: '3', t: 'Pitchen', d: 'Paul schreibt den Pitch – du gibst frei, fertig.' },
];

const FAQ = [
  { q: 'Brauche ich technisches Wissen?', a: 'Nein. Du schreibst mit Felix wie in einem Chat – auf Deutsch. Den Rest erledigt das Team.' },
  { q: 'Woher kommen die Firmendaten?', a: 'Aus Google Places bzw. OpenStreetMap – echte Betriebe, keine erfundenen Daten.' },
  { q: 'Werden Mails automatisch verschickt?', a: 'Nur mit deiner ausdrücklichen Freigabe. Paul zeigt jeden Entwurf zuerst zur Kontrolle.' },
  { q: 'Ist das DSGVO-konform?', a: 'Du behältst die volle Kontrolle: keine Mail verlässt das System ohne deine Bestätigung. Beachte die Regeln zur B2B-Ansprache.' },
  { q: 'Kann ich monatlich kündigen?', a: 'Ja. Alle Tarife sind monatlich kündbar, direkt im Dashboard über das Stripe-Kundenportal.' },
];

export default function StartPage() {
  return (
    <div className={styles.page}>
      <div className={styles.announce}>
        🚀 Neu: Dein KI-Vertriebsteam Felix, Anna &amp; Paul –{' '}
        <Link href="/signup">jetzt kostenlos starten →</Link>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Youman Automation" className={styles.logoImg} />
        <div className={styles.navLinks}>
          <a href="#features">Funktionen</a>
          <a href="#how">So geht’s</a>
          <Link href="/pricing">Preise</Link>
          <Link href="/login">Anmelden</Link>
          <Link href="/signup" className={styles.navCta}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroBlob} aria-hidden />
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>KI-gestützte B2B-Neukundengewinnung</div>
          <h1>
            Dein KI-Vertriebsteam, das <span>Kunden findet</span> – während du dich um dein Geschäft kümmerst.
          </h1>
          <p>
            Felix findet passende Firmen, Anna analysiert sie, Paul schreibt &amp; sendet den Pitch. Du gibst nur noch
            frei – persönlich, DSGVO-konform, auf Deutsch.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Jetzt kostenlos starten
            </Link>
            <Link href="/pricing" className={styles.ctaGhost}>
              Preise ansehen
            </Link>
          </div>
          <div className={styles.trust}>
            <span>✓ Keine Kreditkarte</span>
            <span>✓ In 2 Minuten startklar</span>
            <span>✓ Jederzeit kündbar</span>
          </div>
        </div>

        {/* Produkt-Vorschau */}
        <div className={styles.mock}>
          <div className={styles.mockBar}>
            <span /> <span /> <span />
          </div>
          <div className={styles.mockBody}>
            <ChatLine img="/team/felix.png" name="Felix" accent="#0d63d8" text="3 Restaurants in Borken ohne Website gefunden – Top-Lead: „La Fontanina“." />
            <ChatLine img="/team/anna.png" name="Anna" accent="#7b3fe4" text="Website analysiert. Kontakt: info@la-fontanina.de · Online-Reservierung fehlt." />
            <ChatLine img="/team/paul.png" name="Paul" accent="#1f9d57" text="Entwurf fertig: „Mehr Gäste durch Online-Reservierung“. Soll ich senden?" />
            <div className={styles.mockApprove}>
              <button>Senden ✓</button>
              <span>Freigabe durch dich</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stat strip */}
      <section className={styles.stats}>
        {STATS.map((s) => (
          <div key={s.l} className={styles.stat}>
            <div className={styles.statV}>{s.v}</div>
            <div className={styles.statL}>{s.l}</div>
          </div>
        ))}
      </section>

      {/* Pain */}
      <section className={styles.pain}>
        <h2>Kaltakquise frisst Stunden. Wir geben sie dir zurück.</h2>
        <p>
          Firmen googeln, Websites durchsuchen, E-Mails herausfinden, Texte schreiben – jeden Tag aufs Neue. Dein
          KI-Team erledigt genau das, rund um die Uhr, während du dich auf den Abschluss konzentrierst.
        </p>
      </section>

      {/* Features (alternierend) */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHead}>
          <div className={styles.kicker}>Das Team</div>
          <h2>Drei Spezialisten. Ein nahtloser Ablauf.</h2>
          <p>Jeder kann genau eine Sache – richtig gut. Zusammen sind sie deine Akquise-Maschine.</p>
        </div>

        {FEATURES.map((f, i) => (
          <div key={f.tag} className={`${styles.feature} ${i % 2 ? styles.reverse : ''}`}>
            <div className={styles.featureVisual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt={f.tag} />
            </div>
            <div className={styles.featureText}>
              <div className={styles.featureTag}>{f.tag}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <ul>
                {f.points.map((p) => (
                  <li key={p}>
                    <Svg d={Icon.check} className={styles.liIcon} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* How */}
      <section id="how" className={styles.steps}>
        <div className={styles.sectionHead}>
          <div className={`${styles.kicker} ${styles.kickerLight}`}>In 3 Schritten</div>
          <h2>So einfach geht’s</h2>
        </div>
        <div className={styles.stepGrid}>
          {STEPS.map((s) => (
            <div key={s.n} className={styles.step}>
              <div className={styles.stepNum}>{s.n}</div>
              <div className={styles.stepTitle}>{s.t}</div>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
        <div className={styles.centerCta}>
          <Link href="/signup" className={styles.ctaPrimary}>
            Team kostenlos testen
          </Link>
        </div>
      </section>

      {/* Benefits grid */}
      <section className={styles.benefits}>
        <div className={styles.sectionHead}>
          <div className={styles.kicker}>Warum Youman</div>
          <h2>Gebaut für deinen Vertriebsalltag</h2>
        </div>
        <div className={styles.benefitGrid}>
          {BENEFITS.map((b) => (
            <div key={b.t} className={styles.benefit}>
              <div className={styles.benefitIcon}>
                <Svg d={b.i} />
              </div>
              <div className={styles.benefitTitle}>{b.t}</div>
              <p>{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className={styles.priceTeaser}>
        <div className={styles.sectionHead}>
          <div className={styles.kicker}>Preise</div>
          <h2>Fair &amp; planbar</h2>
          <p>Starte kostenlos. Upgrade, wenn du mehr brauchst.</p>
        </div>
        <div className={styles.teaserCards}>
          {[
            { n: 'Free', p: '0 €', d: '10 Suchen · 5 Mails / Monat' },
            { n: 'Starter', p: '29 €', d: '300 Suchen · 150 Mails / Monat', hot: true },
            { n: 'Pro', p: '79 €', d: '2.000 Suchen · 1.000 Mails / Monat' },
          ].map((t) => (
            <div key={t.n} className={`${styles.teaser} ${t.hot ? styles.teaserHot : ''}`}>
              <div className={styles.teaserName}>{t.n}</div>
              <div className={styles.teaserPrice}>
                {t.p}
                <span>/Monat</span>
              </div>
              <div className={styles.teaserDesc}>{t.d}</div>
            </div>
          ))}
        </div>
        <div className={styles.centerCta}>
          <Link href="/pricing" className={styles.ctaGhost}>
            Alle Tarife im Detail
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faqSection}>
        <div className={styles.sectionHead}>
          <div className={styles.kicker}>FAQ</div>
          <h2>Häufige Fragen</h2>
        </div>
        <div className={styles.faq}>
          {FAQ.map((f) => (
            <div key={f.q} className={styles.faqItem}>
              <div className={styles.faqQ}>{f.q}</div>
              <div className={styles.faqA}>{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.final}>
        <h2>Bereit für planbaren Neukunden-Nachschub?</h2>
        <p>Starte kostenlos – dein KI-Vertriebsteam wartet schon.</p>
        <Link href="/signup" className={styles.ctaPrimaryLg}>
          Jetzt loslegen
        </Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Youman Automation" className={styles.footerLogo} />
            <p>Dein KI-Vertriebsteam für automatisierte B2B-Neukundengewinnung.</p>
          </div>
          <div className={styles.footerCols}>
            <div>
              <h4>Produkt</h4>
              <a href="#features">Funktionen</a>
              <Link href="/pricing">Preise</Link>
              <Link href="/signup">Kostenlos starten</Link>
            </div>
            <div>
              <h4>Konto</h4>
              <Link href="/login">Anmelden</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
            <div>
              <h4>Rechtliches</h4>
              <Link href="/privacy">Datenschutz</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>© {new Date().getFullYear()} Youman Automation. Alle Rechte vorbehalten.</div>
      </footer>
    </div>
  );
}

function ChatLine({ img, name, accent, text }: { img: string; name: string; accent: string; text: string }) {
  return (
    <div className={styles.chatLine}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={name} className={styles.chatAvatar} />
      <div className={styles.chatBubble}>
        <div className={styles.chatName} style={{ color: accent }}>
          {name}
        </div>
        <div className={styles.chatText}>{text}</div>
      </div>
    </div>
  );
}

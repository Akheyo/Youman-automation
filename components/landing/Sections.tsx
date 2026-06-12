import Link from 'next/link';
import { INDUSTRIES } from '@/lib/landing/industries';
import styles from './landing.module.css';

/* ---- Top announcement bar ------------------------------------------------ */
export function Announce() {
  return (
    <div className={styles.announce}>
      ✨ Neu: <strong>Lina</strong>, dein KI-Telefonassistent – ruft Leads an &amp; bucht Termine.{' '}
      <Link href="/signup">Kostenlos starten →</Link>
    </div>
  );
}

/* ---- Sticky navigation --------------------------------------------------- */
export function LandingNav() {
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.navBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Youman Automation" className={styles.logoImg} />
      </Link>
      <div className={styles.navLinks}>
        <Link href="/#branchen">Branchen</Link>
        <Link href="/#how">So geht’s</Link>
        <Link href="/pricing">Preise</Link>
        <Link href="/login">Anmelden</Link>
        <Link href="/signup" className={styles.navCta}>
          Kostenlos starten
        </Link>
      </div>
    </nav>
  );
}

/* ---- Trust strip (honest badges instead of fake client logos) ------------ */
export function TrustStrip() {
  const items = ['DSGVO-konform', 'Server in Deutschland', 'Eigene Rufnummer', 'Google-Kalender-Anbindung', 'Auf Deutsch', 'Monatlich kündbar'];
  return (
    <section className={styles.trust}>
      <span className={styles.trustLead}>Gebaut für den deutschen Mittelstand</span>
      <div className={styles.trustItems}>
        {items.map((t) => (
          <span key={t} className={styles.trustItem}>
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---- Branchen grid ------------------------------------------------------- */
export function BranchenGrid() {
  return (
    <section id="branchen" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.kicker}>Branchen</div>
        <h2>Ein Telefonassistent, der deine Sprache spricht</h2>
        <p>Lina ist auf deine Branche zugeschnitten – mit dem passenden Gesprächsleitfaden und Ziel.</p>
      </div>
      <div className={styles.branchGrid}>
        {INDUSTRIES.map((i) => (
          <Link key={i.slug} href={`/branche/${i.slug}`} className={styles.branchCard}>
            <span className={styles.branchLabel}>{i.label}</span>
            <span className={styles.branchTitle}>
              {i.eyebrow} {i.title} {i.highlight}
            </span>
            <span className={styles.branchMore}>Mehr erfahren →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---- The full team (main page only) -------------------------------------- */
const TEAM = [
  { img: '/team/felix.png', emoji: '🕵️', tag: 'Felix · Lead-Scout', text: 'Findet passende Firmen aus echten Quellen – samt Adresse, Telefon und Website-Status.' },
  { img: '/team/anna.png', emoji: '👩‍🔬', tag: 'Anna · Analystin', text: 'Liest die Website, findet die Kontakt-E-Mail und schätzt jede Firma nach deiner Vorgabe ein.' },
  { img: '/team/paul.png', emoji: '👨‍💼', tag: 'Paul · Pitch & Versand', text: 'Schreibt den persönlichen Pitch und versendet ihn erst nach deiner Freigabe.' },
  { img: '', emoji: '📞', tag: 'Lina · Telefon-Agent', text: 'Ruft Leads an, qualifiziert, prüft deinen Kalender und bucht den Termin selbst.' },
];

export function TeamSection() {
  return (
    <section id="team" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.kicker}>Dein KI-Team</div>
        <h2>Vier Spezialisten. Ein nahtloser Ablauf.</h2>
        <p>Jeder kann genau eine Sache – richtig gut. Zusammen sind sie deine Akquise-Maschine.</p>
      </div>
      <div className={styles.teamGrid}>
        {TEAM.map((m) => (
          <div key={m.tag} className={styles.teamCard}>
            <div className={styles.teamAvatar}>
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.img} alt="" />
              ) : (
                <span className={styles.teamEmoji}>{m.emoji}</span>
              )}
            </div>
            <div className={styles.teamTag}>{m.tag}</div>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- How it works (phone agent) ------------------------------------------ */
export function HowItWorks() {
  const steps = [
    { n: '1', t: 'Lead kommt rein', d: 'Über Formular, CSV-Upload oder direkt aus Felix – die Nummer landet bei Lina.' },
    { n: '2', t: 'Lina ruft an', d: 'Sie stellt sich vor, qualifiziert nach deinem Leitfaden und geht auf Antworten ein.' },
    { n: '3', t: 'Termin im Kalender', d: 'Bei Interesse prüft Lina deine freien Zeiten und bucht den Termin automatisch ein.' },
  ];
  return (
    <section id="how" className={styles.sectionDark}>
      <div className={styles.sectionHead}>
        <div className={`${styles.kicker} ${styles.kickerLight}`}>In 3 Schritten</div>
        <h2>So einfach geht’s</h2>
      </div>
      <div className={styles.stepGrid}>
        {steps.map((s) => (
          <div key={s.n} className={styles.step}>
            <div className={styles.stepNum}>{s.n}</div>
            <div className={styles.stepTitle}>{s.t}</div>
            <p>{s.d}</p>
          </div>
        ))}
      </div>
      <div className={styles.centerCta}>
        <Link href="/signup" className={styles.ctaPrimaryLg}>
          Jetzt kostenlos starten
        </Link>
      </div>
    </section>
  );
}

/* ---- Benefits ------------------------------------------------------------ */
export function Benefits() {
  const items = [
    { t: 'Speed-to-Lead', d: 'Rückruf in unter 60 Sekunden – wenn das Interesse am größten ist.' },
    { t: 'Auf Deutsch', d: 'Natürliche Gespräche auf Deutsch, abgestimmt auf deine Branche.' },
    { t: 'Bucht selbst', d: 'Lina prüft deinen Kalender und trägt Termine direkt ein – kein Hin und Her.' },
    { t: 'DSGVO-konform', d: 'Server in Deutschland, Freigabe-Logik pro Nummer, volle Kontrolle.' },
    { t: 'Rund um die Uhr', d: 'Auch abends und am Wochenende erreichbar – ohne Personalkosten.' },
    { t: 'Volles Transkript', d: 'Jedes Gespräch mit Zusammenfassung und Aufnahme zum Nachlesen.' },
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.kicker}>Warum Youman</div>
        <h2>Gebaut für deinen Vertriebsalltag</h2>
      </div>
      <div className={styles.benefitGrid}>
        {items.map((b) => (
          <div key={b.t} className={styles.benefit}>
            <div className={styles.benefitTitle}>{b.t}</div>
            <p>{b.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- Pricing teaser ------------------------------------------------------ */
export function PricingTeaser() {
  const tiers = [
    { n: 'Free', p: '0 €', d: '5 Anrufe · 10 Suchen / Monat' },
    { n: 'Starter', p: '29 €', d: '100 Anrufe · 300 Suchen / Monat', hot: true },
    { n: 'Pro', p: '79 €', d: '500 Anrufe · 2.000 Suchen / Monat' },
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.kicker}>Preise</div>
        <h2>Fair &amp; planbar</h2>
        <p>Starte kostenlos. Upgrade, wenn du mehr brauchst.</p>
      </div>
      <div className={styles.teaserCards}>
        {tiers.map((t) => (
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
  );
}

/* ---- FAQ ----------------------------------------------------------------- */
export function Faq() {
  const items = [
    { q: 'Klingt Lina wie ein Roboter?', a: 'Nein – Lina spricht natürlich auf Deutsch, hört zu und geht auf Antworten ein. Den Tonfall bestimmst du selbst.' },
    { q: 'Bucht Lina wirklich selbst Termine?', a: 'Ja. Sie prüft live deinen Google-Kalender, schlägt freie Slots vor und trägt den Termin direkt ein.' },
    { q: 'Ist das DSGVO-konform?', a: 'Server in Deutschland, volle Kontrolle und eine Freigabe-Logik pro Nummer. Beachte die Regeln zur telefonischen Ansprache (§7 UWG).' },
    { q: 'Woher kommen die Leads?', a: 'Manuell, per CSV-Upload oder direkt aus Felix – unserem KI-Lead-Scout, der passende Firmen findet.' },
    { q: 'Kann ich monatlich kündigen?', a: 'Ja, alle Tarife sind monatlich kündbar – direkt im Dashboard über das Stripe-Kundenportal.' },
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.kicker}>FAQ</div>
        <h2>Häufige Fragen</h2>
      </div>
      <div className={styles.faq}>
        {items.map((f) => (
          <div key={f.q} className={styles.faqItem}>
            <div className={styles.faqQ}>{f.q}</div>
            <div className={styles.faqA}>{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- Final CTA ----------------------------------------------------------- */
export function FinalCta() {
  return (
    <section className={styles.final}>
      <div className={styles.finalInner}>
        <h2>Bereit für planbaren Neukunden-Nachschub?</h2>
        <p>Starte kostenlos – dein KI-Team ruft an, schreibt und bucht, während du arbeitest.</p>
        <Link href="/signup" className={styles.ctaWhiteLg}>
          Jetzt loslegen
        </Link>
      </div>
    </section>
  );
}

/* ---- Footer -------------------------------------------------------------- */
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Youman Automation" className={styles.footerLogo} />
          <p>Dein KI-Vertriebsteam: Firmen finden, analysieren, anschreiben – und per Telefon zum Termin bringen. Auf Deutsch, DSGVO-konform.</p>
          <a href="mailto:infoall4youstore@gmail.com" className={styles.footerMail}>
            infoall4youstore@gmail.com
          </a>
        </div>
        <div className={styles.footerCols}>
          <div>
            <h4>Produkt</h4>
            <Link href="/#team">Das Team</Link>
            <Link href="/#how">So geht’s</Link>
            <Link href="/pricing">Preise</Link>
            <Link href="/signup">Kostenlos starten</Link>
          </div>
          <div>
            <h4>Branchen</h4>
            {INDUSTRIES.slice(0, 5).map((i) => (
              <Link key={i.slug} href={`/branche/${i.slug}`}>
                {i.label}
              </Link>
            ))}
          </div>
          <div>
            <h4>Konto</h4>
            <Link href="/login">Anmelden</Link>
            <Link href="/signup">Registrieren</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
          <div>
            <h4>Rechtliches</h4>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/agb">AGB</Link>
            <Link href="/widerruf">Widerruf</Link>
            <a href="mailto:infoall4youstore@gmail.com">Kontakt</a>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} Youman Automation. Alle Rechte vorbehalten.</span>
        <span className={styles.footerMade}>Mit ❤️ für den Vertrieb gebaut.</span>
      </div>
    </footer>
  );
}

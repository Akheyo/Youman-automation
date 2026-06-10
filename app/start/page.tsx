import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './start.module.css';

export const metadata: Metadata = {
  title: 'Felix — dein KI-Vertriebsteam | Youman Automation',
  description:
    'Felix findet passende Firmen, Anna analysiert sie, Paul schreibt & sendet den Pitch. Automatisierte B2B-Akquise auf Knopfdruck.',
};

const TEAM = [
  {
    img: '/team/felix.png',
    name: 'Felix',
    role: 'Findet Firmen',
    text: 'Sagt ihm Region & Branche – Felix liefert echte Betriebe samt Adresse, Telefon und Website-Status. Auch gezielt Firmen ohne Website (heiße Leads).',
  },
  {
    img: '/team/anna.png',
    name: 'Anna',
    role: 'Analysiert',
    text: 'Anna liest die Firmen-Website inklusive Impressum, findet die Kontakt-E-Mail und schätzt das Unternehmen genau nach deiner Vorgabe ein.',
  },
  {
    img: '/team/paul.png',
    name: 'Paul',
    role: 'Pitcht & sendet',
    text: 'Paul schreibt eine persönliche Verkaufs-E-Mail, zeigt sie dir als Entwurf – und versendet sie erst nach deiner Freigabe. Kein Spam, volle Kontrolle.',
  },
];

const STEPS = [
  { n: '1', t: 'Suchen', d: '„Restaurants in Borken ohne Website" – Felix findet die Leads.' },
  { n: '2', t: 'Analysieren', d: 'Anna prüft die Firma und holt die E-Mail-Adresse.' },
  { n: '3', t: 'Pitchen', d: 'Paul schreibt den Pitch – du gibst frei, fertig.' },
];

const FAQ = [
  {
    q: 'Brauche ich technisches Wissen?',
    a: 'Nein. Du schreibst mit Felix wie in einem Chat – auf Deutsch. Den Rest erledigt das Team.',
  },
  {
    q: 'Woher kommen die Firmendaten?',
    a: 'Aus Google Places (oder OpenStreetMap) – echte Betriebe, keine erfundenen Daten.',
  },
  {
    q: 'Werden Mails automatisch verschickt?',
    a: 'Nur mit deiner ausdrücklichen Freigabe. Paul zeigt jeden Entwurf zuerst zur Kontrolle.',
  },
  {
    q: 'Kann ich monatlich kündigen?',
    a: 'Ja. Alle Tarife sind monatlich kündbar, direkt im Dashboard über das Stripe-Kundenportal.',
  },
];

export default function StartPage() {
  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Youman Automation" className={styles.logoImg} />
        <div className={styles.navLinks}>
          <Link href="/pricing">Preise</Link>
          <Link href="/login">Anmelden</Link>
          <Link href="/signup" className={styles.navCta}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>KI-gestützte B2B-Akquise</div>
          <h1>
            Dein KI-Vertriebsteam, das <span>Kunden findet</span> – während du schläfst.
          </h1>
          <p>
            Felix, Anna &amp; Paul finden passende Firmen, analysieren sie und schreiben den perfekten Pitch.
            Du gibst nur noch frei.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Jetzt kostenlos starten
            </Link>
            <Link href="/pricing" className={styles.ctaGhost}>
              Preise ansehen
            </Link>
          </div>
          <div className={styles.trust}>Keine Kreditkarte nötig · In 2 Minuten startklar</div>
        </div>
        <div className={styles.heroTeam}>
          {TEAM.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.name} src={m.img} alt={m.name} className={styles.heroAvatar} />
          ))}
        </div>
      </header>

      {/* Pain */}
      <section className={styles.pain}>
        <h2>Kaltakquise frisst Zeit. Wir geben sie dir zurück.</h2>
        <p>
          Firmen googeln, Websites durchsuchen, E-Mails herausfinden, Texte schreiben – Stunden pro Tag.
          Felix macht das in Sekunden, rund um die Uhr.
        </p>
      </section>

      {/* Team */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Drei Spezialisten. Ein Team.</h2>
          <p>Jeder kann genau eine Sache – richtig gut.</p>
        </div>
        <div className={styles.teamGrid}>
          {TEAM.map((m) => (
            <div key={m.name} className={styles.teamCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.img} alt={m.name} className={styles.teamAvatar} />
              <div className={styles.teamName}>{m.name}</div>
              <div className={styles.teamRole}>{m.role}</div>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section className={`${styles.section} ${styles.steps}`}>
        <div className={styles.sectionHead}>
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

      {/* FAQ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
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

      <footer className={styles.footer}>
        <div>© {new Date().getFullYear()} Youman Automation</div>
        <div className={styles.footerLinks}>
          <Link href="/pricing">Preise</Link>
          <Link href="/privacy">Datenschutz</Link>
          <Link href="/login">Anmelden</Link>
        </div>
      </footer>
    </div>
  );
}

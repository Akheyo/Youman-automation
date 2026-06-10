import Link from 'next/link';
import HeroImage from './HeroImage';
import styles from './landing.module.css';

interface Cta {
  href: string;
  label: string;
}

/**
 * The big rounded purple-gradient hero card: eyebrow/back-link, bold headline,
 * checkmark pills, two CTAs and a large photo on the right. Used by the main
 * landing and every industry page.
 */
export default function PremiumHero(props: {
  back?: { href: string; label: string };
  eyebrow?: string;
  titleLead: string;
  titleHighlight: string;
  sub: string;
  bullets: string[];
  photo: string;
  photoAlt: string;
  primary: Cta;
  secondary: Cta;
}) {
  return (
    <header className={styles.heroWrap}>
      <div className={styles.heroCard}>
        <div className={styles.heroLeft}>
          {props.back ? (
            <Link href={props.back.href} className={styles.heroBack}>
              ← {props.back.label}
            </Link>
          ) : props.eyebrow ? (
            <div className={styles.heroEyebrow}>{props.eyebrow}</div>
          ) : null}

          <h1 className={styles.heroTitle}>
            {props.titleLead} <span className={styles.heroTitleHi}>{props.titleHighlight}</span>
          </h1>

          <p className={styles.heroSub}>{props.sub}</p>

          <ul className={styles.heroPills}>
            {props.bullets.map((b) => (
              <li key={b} className={styles.heroPill}>
                <span className={styles.pillTick}>✓</span>
                {b}
              </li>
            ))}
          </ul>

          <div className={styles.heroCtas}>
            <Link href={props.primary.href} className={styles.ctaWhite}>
              {props.primary.label}
            </Link>
            <Link href={props.secondary.href} className={styles.ctaOutline}>
              {props.secondary.label}
            </Link>
          </div>
        </div>

        <div className={styles.heroRight}>
          <HeroImage src={props.photo} alt={props.photoAlt} />
        </div>
      </div>
    </header>
  );
}

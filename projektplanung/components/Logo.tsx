import styles from './logo.module.css';

/**
 * Komplett-Konzept-Wortmarke: Gold-Dreieck mit rotem Marken-Ball + Schriftzug.
 *
 * Interims-Logo in den offiziellen Markenfarben. Soll die exakte Original-Datei
 * verwendet werden: `public/logo.png` ablegen und hier durch ein <img> ersetzen.
 */
export default function Logo({
  size = 'md',
  wordmark = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  wordmark?: boolean;
}) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <svg className={styles.mark} viewBox="0 0 48 44" aria-hidden focusable="false">
        <polygon
          points="24,3 45,41 3,41"
          fill="#F2C200"
          stroke="#122A63"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="24" r="4.6" fill="#D92D20" />
      </svg>
      {wordmark && (
        <span className={styles.words}>
          <span className={styles.line1}>KOMPLETT</span>
          <span className={styles.line2}>KONZEPT</span>
        </span>
      )}
    </span>
  );
}

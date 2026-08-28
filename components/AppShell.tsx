import Link from 'next/link';
import Logo from './Logo';
import styles from './app-shell.module.css';

/** Schlanker, seriöser Header-Shell für den eingeloggten Bereich. */
export default function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.accent} aria-hidden />
      <header className={styles.topbar}>
        <Link href="/projekte" className={styles.brand} aria-label="Komplett Konzept – Projektplanung">
          <Logo size="sm" />
          <span className={styles.divider} aria-hidden />
          <span className={styles.appName}>Projektplanung</span>
        </Link>
        <div className={styles.spacer} />
        {email && (
          <span className={styles.userMail} title={email}>
            {email}
          </span>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.logout}>
            Abmelden
          </button>
        </form>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

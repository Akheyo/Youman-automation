import Link from 'next/link';
import styles from './app-shell.module.css';

/** Schlanker Header-Shell für den eingeloggten Bereich. */
export default function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/projekte" className={styles.brand}>
          <span className={styles.brandMark}>YP</span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Youman Projektplanung</span>
            <span className={styles.brandSub}>PlentyONE-Anbindung</span>
          </span>
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

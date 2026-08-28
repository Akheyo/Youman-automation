'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './app-shell.module.css';

const LINKS = [
  { href: '/projekte', text: 'Projekte' },
  { href: '/lagerplatz', text: 'Lagerplätze' },
];

/** Hauptnavigation des eingeloggten Bereichs. */
export default function NavLinks() {
  const pfad = usePathname();
  return (
    <nav className={styles.nav}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`${styles.navLink} ${pfad?.startsWith(l.href) ? styles.navLinkActive : ''}`}
        >
          {l.text}
        </Link>
      ))}
    </nav>
  );
}

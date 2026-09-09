'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './app-shell.module.css';

const LINKS = [
  { href: '/erfassung', text: 'Erfassung' },
  { href: '/projekte', text: 'Projekte' },
  { href: '/lagerplatz', text: 'Lagerplätze' },
  { href: '/lagerplatz/anlegen', text: 'Lagerorte anlegen' },
  { href: '/lagerplatz/zuweisen', text: 'Zuweisen' },
  { href: '/lagerplatz/suche', text: 'Artikel suchen' },
  { href: '/einstellungen', text: 'Einstellungen' },
];

/** Hauptnavigation des eingeloggten Bereichs. */
export default function NavLinks() {
  const pfad = usePathname() ?? '';
  // Der längste passende Eintrag gewinnt, sonst leuchtet "Lagerplätze" mit,
  // während "Zuweisen" offen ist.
  const treffer = LINKS.filter((l) => pfad === l.href || pfad.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const aktiv = (href: string) => treffer?.href === href;

  return (
    <nav className={styles.nav}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`${styles.navLink} ${aktiv(l.href) ? styles.navLinkActive : ''}`}
        >
          {l.text}
        </Link>
      ))}
    </nav>
  );
}

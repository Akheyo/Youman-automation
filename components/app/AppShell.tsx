'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './app-shell.module.css';

/* Minimal, monochrome line icons (currentColor) — subtle and professional. */
const Icon = {
  grid: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Icon;
  sub?: string;
}

const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Übersicht', icon: 'grid' },
  { href: '/felix', label: 'Felix', icon: 'chat', sub: 'Lead-Scout' },
  { href: '/sales', label: 'Lina', icon: 'phone', sub: 'Telefon-Agent' },
];
const SECONDARY: NavItem[] = [
  { href: '/dashboard#leads', label: 'Leads', icon: 'users' },
  { href: '/dashboard#verlaeufe', label: 'Verläufe', icon: 'history' },
  { href: '/dashboard#einstellungen', label: 'Einstellungen', icon: 'settings' },
];

export default function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The chat owns its full height (internal scroll + pinned composer); other
  // pages scroll normally.
  const variant: 'scroll' | 'fill' = pathname.startsWith('/felix') ? 'fill' : 'scroll';

  const isActive = (href: string) => {
    const base = href.split('#')[0] ?? href;
    return pathname === base || (base !== '/dashboard' && pathname.startsWith(base));
  };

  const navList = (
    <>
      <div className={styles.navGroup}>
        {PRIMARY.map((n) => (
          <Link key={n.href} href={n.href} className={`${styles.navItem} ${isActive(n.href) ? styles.navActive : ''}`} onClick={() => setOpen(false)}>
            <span className={styles.navIcon}>{Icon[n.icon]}</span>
            <span className={styles.navText}>
              <span className={styles.navLabel}>{n.label}</span>
              {n.sub && <span className={styles.navSub}>{n.sub}</span>}
            </span>
          </Link>
        ))}
      </div>
      <div className={styles.navDivider} />
      <div className={styles.navGroup}>
        {SECONDARY.map((n) => (
          <Link key={n.href} href={n.href} className={styles.navItemSm} onClick={() => setOpen(false)}>
            <span className={styles.navIcon}>{Icon[n.icon]}</span>
            <span className={styles.navLabel}>{n.label}</span>
          </Link>
        ))}
        <Link href="/pv" className={styles.navItemSm} onClick={() => setOpen(false)}>
          <span className={styles.navIcon}>{Icon.sun}</span>
          <span className={styles.navLabel}>PV-Konfigurator</span>
        </Link>
      </div>
    </>
  );

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Youman Automation" className={styles.logo} />
        </Link>
        <nav className={styles.nav}>{navList}</nav>
        <div className={styles.userBox}>
          {email && <div className={styles.userMail} title={email}>{email}</div>}
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.logout}>Abmelden</button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className={styles.topbar}>
        <button className={styles.burger} onClick={() => setOpen((v) => !v)} aria-label="Menü">
          <span /><span /><span />
        </button>
        <Link href="/dashboard" className={styles.brandMobile}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Youman Automation" className={styles.logoMobile} />
        </Link>
        <div className={styles.topSpacer} />
      </header>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className={styles.scrim} onClick={() => setOpen(false)} />
          <div className={styles.drawer}>
            <nav className={styles.nav}>{navList}</nav>
            <div className={styles.userBox}>
              {email && <div className={styles.userMail}>{email}</div>}
              <form action="/auth/signout" method="post">
                <button type="submit" className={styles.logout}>Abmelden</button>
              </form>
            </div>
          </div>
        </>
      )}

      <main className={`${styles.content} ${variant === 'fill' ? styles.contentFill : styles.contentScroll}`}>{children}</main>
    </div>
  );
}

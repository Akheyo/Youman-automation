'use client';

/**
 * Lightweight, dependency-free cookie consent banner (TTDSG).
 * Stores the choice in localStorage. Non-essential trackers (e.g. analytics)
 * should check `window.localStorage.ym_cookie_consent === 'all'` before loading.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'ym_cookie_consent';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* localStorage blocked → don't show */
    }
  }, []);

  function choose(value: 'all' | 'essential') {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie-Hinweis">
      <div className="cookie-banner__text">
        Wir verwenden nur technisch notwendige Cookies. Optionale (z. B. für anonyme Statistik) erst mit deiner
        Zustimmung. Mehr in der{' '}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </div>
      <div className="cookie-banner__actions">
        <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={() => choose('essential')}>
          Nur notwendige
        </button>
        <button type="button" className="cookie-banner__btn cookie-banner__btn--primary" onClick={() => choose('all')}>
          Alle akzeptieren
        </button>
      </div>
    </div>
  );
}

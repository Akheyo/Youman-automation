'use client';

import { useApp } from '@/lib/store';

/**
 * Action-oriented error banner. NEVER says just "Fehler" — always pairs with
 * an actionable next step.
 */
export default function ResultBanner() {
  const banner = useApp((s) => s.errorBanner);
  const setError = useApp((s) => s.setError);

  if (!banner) return null;

  return (
    <div className="banner banner--error" role="alert">
      <div className="banner__body">
        <strong className="banner__title">{banner.title}</strong>
        {banner.action && <p className="banner__action">{banner.action}</p>}
        {banner.detail && <code className="banner__detail">{banner.detail}</code>}
      </div>
      <button
        type="button"
        className="banner__close"
        onClick={() => setError(null)}
        aria-label="Banner schließen"
      >
        ×
      </button>
    </div>
  );
}

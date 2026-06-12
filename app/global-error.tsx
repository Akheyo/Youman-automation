'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No-op when Sentry isn't initialised (no DSN configured).
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          margin: 0,
          background: '#f4f0fb',
          color: '#1b1430',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>Etwas ist schiefgelaufen.</h2>
          <p style={{ color: '#6b6385', marginBottom: 20 }}>
            Wir wurden automatisch informiert. Bitte versuche es erneut.
          </p>
          <button
            onClick={reset}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '11px 22px',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(120deg, #7c3aed, #a855f7)',
              cursor: 'pointer',
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}

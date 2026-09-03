'use client';

import { useState } from 'react';

type State = 'bereit' | 'laeuft' | 'fertig' | 'fehler';

export default function Abmeldung({ token }: { token: string }) {
  const [state, setState] = useState<State>('bereit');

  async function abmelden() {
    setState('laeuft');
    try {
      const res = await fetch(`/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' });
      setState(res.ok ? 'fertig' : 'fehler');
    } catch {
      setState('fehler');
    }
  }

  return (
    <main style={wrap}>
      <div style={card}>
        <h1 style={h1}>Keine weiteren Nachrichten</h1>
        {state === 'fertig' ? (
          <p style={p}>
            Erledigt — Sie sind abgemeldet. Ihre Adresse steht ab sofort auf unserer Sperrliste, Sie bekommen aus dieser und jeder
            weiteren Kampagne keine Nachricht mehr.
          </p>
        ) : (
          <>
            <p style={p}>
              Ein Klick, und wir schreiben Ihnen nicht wieder. Ihre Adresse wird dauerhaft gesperrt — auch für künftige Kampagnen.
            </p>
            <button style={{ ...button, opacity: state === 'laeuft' ? 0.6 : 1 }} onClick={abmelden} disabled={state === 'laeuft'}>
              {state === 'laeuft' ? 'Einen Moment …' : 'Jetzt abmelden'}
            </button>
            {state === 'fehler' && (
              <p style={{ ...p, color: '#b91c1c' }}>
                Das hat gerade nicht geklappt. Bitte antworten Sie einfach auf die E-Mail mit „bitte austragen“ — wir erledigen es
                dann von Hand.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'linear-gradient(180deg, #faf8ff 0%, #f3eefc 100%)',
  fontFamily: "'Heebo', system-ui, -apple-system, sans-serif",
  color: '#1b1733',
};
const card: React.CSSProperties = {
  maxWidth: 460,
  background: '#fff',
  borderRadius: 20,
  padding: '32px 30px',
  boxShadow: '0 20px 50px rgba(124, 58, 237, 0.14)',
  border: '1px solid #ece4fb',
};
const h1: React.CSSProperties = { margin: '0 0 12px', fontSize: 22, fontWeight: 800 };
const p: React.CSSProperties = { margin: '0 0 18px', fontSize: 15, lineHeight: 1.6, color: '#4b4560' };
const button: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: '12px 20px',
  fontSize: 15,
  fontWeight: 700,
  color: '#fff',
  background: 'linear-gradient(115deg, #6d28d9, #a855f7)',
  cursor: 'pointer',
};

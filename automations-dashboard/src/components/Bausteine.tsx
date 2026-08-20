import type { Ton } from '../lib/labels';

const punktKlassen: Record<Ton, string> = {
  blau: 'punktBlau',
  gelb: 'punktGelb',
  rot: 'punktRot',
  leise: 'punktLeise',
};

const etikettKlassen: Record<Ton, string> = {
  blau: 'etikettBlau',
  gelb: 'etikettGelb',
  rot: 'etikettRot',
  leise: '',
};

export function Punkt({ ton, pulst = false }: { ton: Ton; pulst?: boolean }) {
  return <span className={`punkt ${punktKlassen[ton]} ${pulst ? 'pulst' : ''}`} aria-hidden="true" />;
}

export function Etikett({ ton, text, pulst = false }: { ton: Ton; text: string; pulst?: boolean }) {
  return (
    <span className={`etikett ${etikettKlassen[ton]}`}>
      <Punkt ton={ton} pulst={pulst} />
      {text}
    </span>
  );
}

export function WertPaar({ name, wert }: { name: string; wert: React.ReactNode }) {
  return (
    <div>
      <div className="wertPaarName">{name}</div>
      <div className="wertPaarWert">{wert}</div>
    </div>
  );
}

export function LeererZustand({
  titel,
  text,
  aktion,
}: {
  titel: string;
  text: string;
  aktion?: React.ReactNode;
}) {
  return (
    <div className="leer">
      <strong>{titel}</strong>
      <span>{text}</span>
      {aktion}
    </div>
  );
}

export function Meldung({ ton, children }: { ton: 'blau' | 'rot'; children: React.ReactNode }) {
  return <div className={`meldung ${ton === 'rot' ? 'meldungRot' : 'meldungBlau'}`}>{children}</div>;
}

export function Pfeil({ offen }: { offen: boolean }) {
  return (
    <svg
      className={`pfeil ${offen ? 'pfeilOffen' : ''}`}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

import Zeichen, { type ZeichenName } from './Icons';
import type { Ton } from '../lib/labels';

const etikettKlassen: Record<Ton, string> = {
  blau: 'etikettBlau',
  gelb: 'etikettGelb',
  rot: 'etikettRot',
  leise: '',
};

/**
 * Ein Etikett sagt einen Zustand immer dreifach: Farbe, Zeichen und deutsches
 * Wort. Wer Farben schlecht unterscheidet, liest trotzdem sofort, was los ist.
 */
export function Etikett({
  ton,
  text,
  zeichen,
  dreht = false,
}: {
  ton: Ton;
  text: string;
  zeichen: ZeichenName;
  dreht?: boolean;
}) {
  return (
    <span className={`etikett ${etikettKlassen[ton]}`}>
      <span className="etikettZeichen">
        <Zeichen name={zeichen} groesse={13} strich={2.2} klasse={dreht ? 'dreht' : undefined} />
      </span>
      {text}
    </span>
  );
}

export function WertPaar({ name, wert, leise = false }: { name: string; wert: React.ReactNode; leise?: boolean }) {
  return (
    <div>
      <div className="wertPaarName">{name}</div>
      <div className={`wertPaarWert ${leise ? 'wertPaarLeise' : ''}`}>{wert}</div>
    </div>
  );
}

export function LeererZustand({
  titel,
  text,
  zeichen = 'postfach',
  aktion,
}: {
  titel: string;
  text: string;
  zeichen?: ZeichenName;
  aktion?: React.ReactNode;
}) {
  return (
    <div className="leer">
      <span className="leerZeichen">
        <Zeichen name={zeichen} groesse={20} />
      </span>
      <strong>{titel}</strong>
      <p>{text}</p>
      {aktion}
    </div>
  );
}

const meldungZeichen: Record<'blau' | 'gelb' | 'rot', ZeichenName> = {
  blau: 'auskunft',
  gelb: 'warnkreis',
  rot: 'warndreieck',
};

export function Meldung({ ton, children }: { ton: 'blau' | 'gelb' | 'rot'; children: React.ReactNode }) {
  const klassen = { blau: 'meldungBlau', gelb: 'meldungGelb', rot: 'meldungRot' };
  return (
    <div className={`meldung ${klassen[ton]}`}>
      <Zeichen name={meldungZeichen[ton]} groesse={16} />
      <div>{children}</div>
    </div>
  );
}

export function Pfeil({ offen }: { offen: boolean }) {
  return (
    <span className={`pfeil ${offen ? 'pfeilOffen' : ''}`}>
      <Zeichen name="pfeilRechts" groesse={16} />
    </span>
  );
}

/** Farbe des Zuverlässigkeitsbalkens: ab 95 in Ordnung, ab 80 hinschauen. */
export function quoteFarbe(quote: number | null): string {
  if (quote === null) return 'var(--rand-stark)';
  if (quote >= 95) return 'var(--blau)';
  if (quote >= 80) return 'var(--gelb)';
  return 'var(--rot)';
}

export function QuoteBalken({ quote }: { quote: number | null }) {
  return (
    <span className="quoteBalken" aria-hidden="true">
      <span
        className="quoteFuellung"
        style={{ width: `${Math.max(2, Math.min(100, quote ?? 0))}%`, background: quoteFarbe(quote) }}
      />
    </span>
  );
}

/** Ladeflächen statt Textmeldungen: die Seite behält ihre Form. */
export function Skelett({ breite = '100%', hoehe = 14 }: { breite?: string; hoehe?: number }) {
  return <span className="skelett" style={{ width: breite, height: hoehe, display: 'block' }} />;
}

export function SkelettKarten({ anzahl = 3, zeilen = 3 }: { anzahl?: number; zeilen?: number }) {
  return (
    <div className="liste" aria-busy="true" aria-live="polite">
      <span className="nurVorlesen">Die Daten werden geladen.</span>
      {Array.from({ length: anzahl }, (_, i) => (
        <div key={i} className="skelettKarte">
          <Skelett breite="42%" hoehe={16} />
          {Array.from({ length: zeilen - 1 }, (_, j) => (
            <Skelett key={j} breite={j % 2 === 0 ? '78%' : '60%'} hoehe={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

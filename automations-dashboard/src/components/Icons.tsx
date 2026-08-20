/**
 * Ein kleiner, einheitlicher Zeichensatz. Alles gezeichnet, keine Emojis.
 * Jedes Zeichen erbt die Farbe des Textes und ist standardmäßig für
 * Vorleseprogramme unsichtbar, weil daneben immer ein deutsches Wort steht.
 */

export type ZeichenName =
  | 'haken'
  | 'warndreieck'
  | 'warnkreis'
  | 'kritisch'
  | 'auskunft'
  | 'pause'
  | 'start'
  | 'stopp'
  | 'wiederholen'
  | 'kreisel'
  | 'puls'
  | 'pfeilRechts'
  | 'pfeilRaus'
  | 'lupe'
  | 'raster'
  | 'liste'
  | 'menschen'
  | 'abmelden'
  | 'neuLaden'
  | 'schliessen'
  | 'postfach'
  | 'uhr'
  | 'blitz'
  | 'schild'
  | 'hand';

const pfade: Record<ZeichenName, React.ReactNode> = {
  haken: <path d="M20 6L9 17l-5-5" />,
  warndreieck: (
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  warnkreis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </>
  ),
  kritisch: (
    <>
      <path d="M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6L8.6 3z" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </>
  ),
  auskunft: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  start: <path d="M6 4l14 8-14 8V4z" />,
  stopp: <rect x="5" y="5" width="14" height="14" rx="2" />,
  wiederholen: (
    <>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  kreisel: (
    <>
      <circle cx="12" cy="12" r="9" opacity="0.28" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </>
  ),
  puls: <path d="M3 12h4l2.5-7 5 14L17 12h4" />,
  pfeilRechts: <path d="M9 18l6-6-6-6" />,
  pfeilRaus: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </>
  ),
  lupe: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  raster: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  liste: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </>
  ),
  menschen: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  abmelden: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  neuLaden: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>
  ),
  schliessen: (
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  postfach: (
    <>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
      <path d="M3 12l2.5-7h13L21 12" />
      <path d="M3 12h5l1.5 3h5L16 12h5" />
    </>
  ),
  uhr: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  blitz: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  schild: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  hand: (
    <>
      <path d="M11 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 10.5V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M17 11.5v-1a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5.3-3.2L5 14.5a1.6 1.6 0 0 1 2.6-1.8L9 14V8.5a1.5 1.5 0 0 1 3 0" />
    </>
  ),
};

interface Eigenschaften {
  name: ZeichenName;
  groesse?: number;
  strich?: number;
  klasse?: string;
  /** Nur setzen, wenn kein Text daneben steht. */
  beschriftung?: string;
}

export default function Zeichen({ name, groesse = 16, strich = 2, klasse, beschriftung }: Eigenschaften) {
  const gefuellt = name === 'start' || name === 'blitz';
  return (
    <svg
      className={klasse}
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill={gefuellt ? 'currentColor' : 'none'}
      stroke={gefuellt ? 'none' : 'currentColor'}
      strokeWidth={strich}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={beschriftung ? 'img' : undefined}
      aria-label={beschriftung}
      aria-hidden={beschriftung ? undefined : true}
      focusable="false"
    >
      {pfade[name]}
    </svg>
  );
}

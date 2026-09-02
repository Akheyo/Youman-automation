/**
 * SVG-Icons fuer die Sapore-Grill-Seite (Strichstil nach Lucide, 1.75px).
 * Bewusst als Inline-SVG statt Emoji, damit Farbe und Groesse ueber CSS laufen.
 * Rein dekorativ -> `aria-hidden`; die Bedeutung steht immer im Text daneben.
 */

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconFlame(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3c.5 3 2.5 4 3.8 5.6A6.4 6.4 0 0 1 17.5 13a5.5 5.5 0 0 1-11 0c0-1.6.8-3 1.8-4 .3 1 .9 1.6 1.7 1.8-.3-2.6.6-5.6 2-7.8Z" />
    </Svg>
  );
}

export function IconPhone(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.3 3.5h3l1.5 3.7-1.9 1.1a11 11 0 0 0 4.8 4.8l1.1-1.9 3.7 1.5v3a2 2 0 0 1-2.2 2 16.5 16.5 0 0 1-13.8-13.8 2 2 0 0 1 2-2.2Z" />
    </Svg>
  );
}

export function IconPin(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21s7-5.4 7-10.5a7 7 0 1 0-14 0C5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.6" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconInstagram(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="16.9" cy="7.1" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function IconLeaf(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 19.5C4 14 6.5 9 11 6.6c2.4-1.3 5.3-1.6 8.5-1.1.5 3.2.2 6.1-1.1 8.5C16 18.5 11 21 5.5 20.5" />
      <path d="M5.5 19.5C8 15 12 11.5 17 9.5" />
    </Svg>
  );
}

export function IconBag(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 8h13l-1 12.5h-11L5.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Svg>
  );
}

export function IconMoped(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="5.5" cy="17" r="2.8" />
      <circle cx="18" cy="17" r="2.8" />
      <path d="M8.3 17h6.9M15.2 17l-2.4-8.5H10" />
      <path d="M12.8 8.5h4.4l1.4 5.7" />
    </Svg>
  );
}

export function IconCart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 4.5h2l2.2 10.2h9l1.8-7.2H6.2" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="16.5" cy="19" r="1.4" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  );
}

export function IconMinus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 12h13" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 6.5h15M9.5 6.5V4.8h5v1.7M6.8 6.5l.9 12.2h8.6l.9-12.2" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.6" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v3.8M12 16.4v.4" />
    </Svg>
  );
}

export function IconMenuBars(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function IconCopy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9" />
    </Svg>
  );
}

/** Wortmarke im Kopf: Doenerspiess ueber Flamme, Gold auf Dunkel. */
export function BrandMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22.5" fill="#171512" stroke="#d9a441" strokeWidth="1.5" />
      <path
        d="M24 8.5c2.6 3.4 4.2 6.4 4.2 9.6 0 1.6-.4 3-1.1 4.3.9-.4 1.6-1.1 2.1-2 1.4 1.7 2.2 3.7 2.2 5.8 0 4.6-3.3 8.3-7.4 8.3s-7.4-3.7-7.4-8.3c0-3.5 1.9-6.7 4.6-9-.3 1.5 0 2.8.8 3.7-.5-4.4.9-8.6 2-12.4Z"
        fill="#e0322d"
      />
      <path d="M17 38.5h14" stroke="#d9a441" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 34.8v3.7M28 34.8v3.7" stroke="#d9a441" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3v10h-17v-10Z" />
      <circle cx="12" cy="13" r="3.4" />
    </Svg>
  );
}

export function IconStar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z" />
    </Svg>
  );
}

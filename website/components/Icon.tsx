import type { IconName } from '@/lib/site'

const paths: Record<IconName, React.ReactNode> = {
  workflow: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="15" y="15" width="6" height="6" rx="1.5" />
      <path d="M6 9v3a3 3 0 0 0 3 3h3" />
      <path d="M15 6h3a3 3 0 0 1 3 3v1" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.2-4.2A8 8 0 1 1 21 12Z" />
      <path d="M9 11h6M9 14.5h3.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2.2l2.3 11.2a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.8-1.4L21 7H6" />
    </>
  ),
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 8 7 9.5 4.1-1.5 7-5.3 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.4 11 16 12l-2.6 1L12 15.5 10.6 13 8 12l2.6-1L12 8.5Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.8 7 7.2 5.4a1.7 1.7 0 0 0 2 0L20.2 7" />
    </>
  ),
  phone: (
    <path d="M7 3.5h2.2l1.6 4-2 1.4a12 12 0 0 0 6.3 6.3l1.4-2 4 1.6V17a3.5 3.5 0 0 1-3.9 3.5A16.6 16.6 0 0 1 3.5 7.4 3.5 3.5 0 0 1 7 3.5Z" />
  ),
  pin: (
    <>
      <path d="M12 21c4-4.6 6-8 6-10.6A6 6 0 0 0 6 10.4C6 13 8 16.4 12 21Z" />
      <circle cx="12" cy="10.3" r="2.3" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  minus: <path d="M5 12h14" />,
}

type Props = {
  name: IconName
  size?: number
  className?: string
  /** Give an icon a label only when it carries meaning on its own. */
  label?: string
}

export function Icon({ name, size = 20, className, label }: Props) {
  const decorative = !label
  return (
    <svg
      className={['icon', name === 'arrow' ? 'icon--arrow' : '', className]
        .filter(Boolean)
        .join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      focusable="false"
    >
      {label ? <title>{label}</title> : null}
      {paths[name]}
    </svg>
  )
}

type Props = {
  /** Visual size. The wordmark scales from a single custom property. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * The wordmark is set in type rather than shipped as an image: it stays sharp at
 * every size, costs no extra request, and the company name stays real text for
 * search engines and screen readers.
 */
export function Logo({ size = 'md', className }: Props) {
  const cls = ['logo', size !== 'md' ? `logo--${size}` : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={cls}>
      <span className="logo__rule" aria-hidden="true" />
      <span className="logo__type">
        <span className="logo__word">Youman</span>
        <span className="logo__sub">AI &amp; Software</span>
      </span>
    </span>
  )
}

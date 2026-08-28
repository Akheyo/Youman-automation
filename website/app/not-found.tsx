import Link from 'next/link'
import { Icon } from '@/components/Icon'

export const metadata = {
  title: 'Seite nicht gefunden',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="container notfound">
      <p className="notfound__code">404</p>
      <h1 style={{ fontSize: 'var(--t-2xl)' }}>Diese Seite gibt es nicht</h1>
      <p className="lead" style={{ marginInline: 'auto' }}>
        Vielleicht wurde sie verschoben oder der Link enthält einen Tippfehler.
      </p>
      <div className="notfound__actions">
        <Link href="/" className="btn btn--primary">
          Zur Startseite
          <Icon name="arrow" size={16} />
        </Link>
        <Link href="/kontakt" className="btn btn--ghost">
          Kontakt
        </Link>
      </div>
    </div>
  )
}

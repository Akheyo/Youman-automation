import { existsSync } from 'node:fs'
import { join } from 'node:path'

const EIGENES_LOGO = '/logo.png'

// Liegt eine echte Logodatei unter public/logo.png, wird sie benutzt.
// Sonst greift die SVG-Nachbildung in den Markenfarben.
const hatEigenesLogo = existsSync(join(process.cwd(), 'public', 'logo.png'))

export function Logo({ size = 30 }: { size?: number }) {
  if (hatEigenesLogo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={EIGENES_LOGO} alt="Komplett Konzept" height={size} style={{ height: size, width: 'auto' }} />
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Komplett Konzept">
      <path d="M24 5 45 41H3Z" fill="#F2C200" stroke="#B08D00" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="17" cy="27" r="6.5" fill="#D92D20" />
      <circle cx="15" cy="25" r="2" fill="#fff" opacity="0.5" />
      <text
        x="31"
        y="33"
        textAnchor="middle"
        fontSize="17"
        fontWeight="800"
        fill="#1B3D9E"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        KK
      </text>
    </svg>
  )
}

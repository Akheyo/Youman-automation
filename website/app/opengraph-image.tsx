import { ImageResponse } from 'next/og'
import { site } from '@/lib/site'

export const alt = `${site.fullName} — KI-Automationen, Chatbots und Websites`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Social preview card, generated at build time in the site's own type style. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0f172a',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 28 }}>
          <div style={{ width: 4, background: '#ffffff' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                fontSize: 64,
                letterSpacing: 22,
                color: '#09090b',
                fontWeight: 300,
              }}
            >
              YOUMAN
            </div>
            <div style={{ fontSize: 20, letterSpacing: 10, color: '#94a3b8' }}>
              AI &amp; SOFTWARE
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 52,
            lineHeight: 1.2,
            color: '#ffffff',
            maxWidth: 900,
          }}
        >
          Prozesse, die heute Menschen kosten, laufen morgen allein.
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: '#94a3b8',
            borderTop: '1px solid #334155',
            paddingTop: 32,
          }}
        >
          <span>E-Commerce · Logistik · Produktion · Großhandel</span>
          <span>youman-automation.de</span>
        </div>
      </div>
    ),
    size,
  )
}

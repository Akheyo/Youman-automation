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
          background: '#ffffff',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 28 }}>
          <div style={{ width: 3, background: '#09090b' }} />
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
            <div style={{ fontSize: 20, letterSpacing: 10, color: '#52525b' }}>
              AI &amp; SOFTWARE
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 54,
            lineHeight: 1.15,
            color: '#09090b',
            maxWidth: 900,
          }}
        >
          Software und KI, die Arbeit abnimmt.
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: '#52525b',
            borderTop: '1px solid #e4e4e7',
            paddingTop: 32,
          }}
        >
          <span>KI-Automationen · Chatbots · Websites · E-Commerce</span>
          <span>youman-automation.de</span>
        </div>
      </div>
    ),
    size,
  )
}

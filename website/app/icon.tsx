import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

/** Favicon: the logo's vertical rule plus the Y, in the site's monochrome. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: '#ffffff',
        }}
      >
        <div style={{ width: 4, height: 40, background: '#09090b' }} />
        <div style={{ fontSize: 40, color: '#09090b', lineHeight: 1 }}>Y</div>
      </div>
    ),
    size,
  )
}

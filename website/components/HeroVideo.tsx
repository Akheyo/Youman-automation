'use client'

import { useEffect, useRef, useState } from 'react'
import { videos, type Video, type VideoKey } from '@/lib/videos'

type Props = {
  video: VideoKey
  className?: string
}

/**
 * Video im Hero.
 *
 * Liegt eine Datei vor, läuft sie stumm als Schleife. Ansonsten erscheint ein
 * markierter Platzhalter mit den Vorgaben — wie bei den Bildern.
 *
 * Zwei Regeln, die hier zwingend sind:
 * - Bewegung, die länger als fünf Sekunden automatisch läuft, braucht eine
 *   Möglichkeit zum Anhalten (WCAG 2.2.2). Der Knopf unten rechts erfüllt das.
 * - Wer `prefers-reduced-motion` gesetzt hat, bekommt das Standbild und keinen
 *   automatischen Start.
 */
export function HeroVideo({ video, className }: Props) {
  const eintrag: Video = videos[video]
  const ref = useRef<HTMLVideoElement>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [wenigerBewegung, setWenigerBewegung] = useState(false)

  useEffect(() => {
    const abfrage = window.matchMedia('(prefers-reduced-motion: reduce)')
    setWenigerBewegung(abfrage.matches)

    const aendern = (e: MediaQueryListEvent) => setWenigerBewegung(e.matches)
    abfrage.addEventListener('change', aendern)
    return () => abfrage.removeEventListener('change', aendern)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !eintrag.datei) return

    if (wenigerBewegung) {
      el.pause()
      setLaeuft(false)
      return
    }

    // Autoplay kann vom Browser abgelehnt werden; der Zustand muss stimmen.
    el.play().then(
      () => setLaeuft(true),
      () => setLaeuft(false),
    )
  }, [wenigerBewegung, eintrag.datei])

  const stil = { aspectRatio: eintrag.verhaeltnis.replace('/', ' / ') }

  if (!eintrag.datei) {
    return (
      <div
        className={['figure', 'figure--leer', className].filter(Boolean).join(' ')}
        style={stil}
        role="img"
        aria-label={`Platzhalter für ein Video: ${eintrag.beschreibung}`}
      >
        <div className="figure__hinweis" aria-hidden="true">
          <span className="figure__marke">Video fehlt</span>
          <p className="figure__motiv">{eintrag.motiv}</p>
          <p className="figure__masse">
            {eintrag.verhaeltnis.replace('/', ':')} · {eintrag.laenge} · MP4 (H.264),
            ohne Ton
          </p>
        </div>
      </div>
    )
  }

  function umschalten() {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      el.play().then(() => setLaeuft(true), () => undefined)
    } else {
      el.pause()
      setLaeuft(false)
    }
  }

  return (
    <div className={['figure', 'figure--video', className].filter(Boolean).join(' ')} style={stil}>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="metadata"
        poster={eintrag.standbild}
        autoPlay={!wenigerBewegung}
        aria-label={eintrag.beschreibung}
      >
        {eintrag.dateiWebm ? <source src={eintrag.dateiWebm} type="video/webm" /> : null}
        <source src={eintrag.datei} type="video/mp4" />
      </video>

      <button
        type="button"
        className="figure__steuerung"
        onClick={umschalten}
        aria-pressed={laeuft}
      >
        {laeuft ? 'Video anhalten' : 'Video abspielen'}
      </button>
    </div>
  )
}

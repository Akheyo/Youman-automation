'use client'

import { useEffect, useRef, useState } from 'react'
import { videos, type Video, type VideoKey } from '@/lib/videos'

type Props = {
  video: VideoKey
  /** Wird gezeigt, solange kein Video vorliegt — besser als ein leerer Kasten. */
  ersatzbild?: React.ReactNode
  /** Füllt den umgebenden Rahmen, statt ein Seitenverhältnis zu erzwingen. */
  fuellt?: boolean
  /** Vom Server ermittelte Pfade, siehe app/page.tsx. */
  quellen?: { mp4?: string; webm?: string; standbild?: string }
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
export function HeroVideo({ video, quellen, ersatzbild, fuellt, className }: Props) {
  const registriert: Video = videos[video]
  // Ausdrücklicher Eintrag im Register schlägt die gefundene Datei.
  const eintrag: Video = {
    ...registriert,
    datei: registriert.datei ?? quellen?.mp4,
    dateiWebm: registriert.dateiWebm ?? quellen?.webm,
    standbild: registriert.standbild ?? quellen?.standbild,
  }
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

  const stil = fuellt
    ? { position: 'absolute' as const, inset: 0 }
    : { aspectRatio: eintrag.verhaeltnis.replace('/', ' / ') }

  // Kein Video vorhanden: lieber das Standbild der Seite zeigen als einen
  // Platzhalterkasten. Der Hero ist das Erste, was jemand sieht.
  if (!eintrag.datei && ersatzbild) return <>{ersatzbild}</>

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

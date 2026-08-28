'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Bewegter Hintergrund für den Hero — im Code erzeugt statt als Videodatei.
 *
 * Motiv: Knoten, zwischen denen Verbindungen entstehen und wieder vergehen.
 * Das ist die Sache, um die es auf der Seite geht, und es kostet ein paar
 * Kilobyte statt mehrerer Megabyte.
 *
 * Drei Dinge sind hier Pflicht, nicht Zugabe:
 * - Bewegung über fünf Sekunden braucht eine Möglichkeit zum Anhalten
 *   (WCAG 2.2.2). Der Knopf unten rechts erfüllt das.
 * - Bei `prefers-reduced-motion` wird ein einziges Standbild gezeichnet.
 * - Außerhalb des Sichtfelds pausiert die Schleife, damit sie beim Lesen
 *   weiter unten keine Rechenzeit verbraucht.
 */
export function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [laeuft, setLaeuft] = useState(true)
  const laeuftRef = useRef(true)

  useEffect(() => {
    laeuftRef.current = laeuft
  }, [laeuft])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const wenigerBewegung = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let breite = 0
    let hoehe = 0
    let dpr = 1

    type Knoten = { x: number; y: number; vx: number; vy: number; r: number }
    let knoten: Knoten[] = []

    function aufbauen() {
      const rect = canvas!.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      breite = rect.width
      hoehe = rect.height
      canvas!.width = Math.round(breite * dpr)
      canvas!.height = Math.round(hoehe * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Dichte an die Fläche koppeln, sonst wirkt es auf großen Schirmen leer
      // und auf kleinen überladen.
      const anzahl = Math.round(Math.min(64, Math.max(22, (breite * hoehe) / 26000)))
      knoten = Array.from({ length: anzahl }, () => ({
        x: Math.random() * breite,
        y: Math.random() * hoehe,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.4 + 0.8,
      }))
    }

    function zeichnen() {
      ctx!.clearRect(0, 0, breite, hoehe)

      // Verbindungen zuerst, damit die Punkte darauf liegen
      const grenze = Math.min(190, breite / 6)
      for (let i = 0; i < knoten.length; i++) {
        for (let j = i + 1; j < knoten.length; j++) {
          const dx = knoten[i].x - knoten[j].x
          const dy = knoten[i].y - knoten[j].y
          const abstand = Math.hypot(dx, dy)
          if (abstand > grenze) continue
          // Je näher, desto deutlicher — aber nie so kräftig, dass es
          // vom Text ablenkt.
          const staerke = (1 - abstand / grenze) * 0.16
          ctx!.strokeStyle = `rgba(255,255,255,${staerke.toFixed(3)})`
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.moveTo(knoten[i].x, knoten[i].y)
          ctx!.lineTo(knoten[j].x, knoten[j].y)
          ctx!.stroke()
        }
      }

      ctx!.fillStyle = 'rgba(255,255,255,0.34)'
      for (const k of knoten) {
        ctx!.beginPath()
        ctx!.arc(k.x, k.y, k.r, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function bewegen() {
      for (const k of knoten) {
        k.x += k.vx
        k.y += k.vy
        // An den Rändern umkehren statt umbrechen: ein Punkt, der plötzlich
        // auf der anderen Seite auftaucht, fällt unangenehm auf.
        if (k.x < 0 || k.x > breite) k.vx *= -1
        if (k.y < 0 || k.y > hoehe) k.vy *= -1
      }
    }

    let frame = 0
    let sichtbar = true

    function schleife() {
      if (laeuftRef.current && sichtbar) {
        bewegen()
        zeichnen()
      }
      frame = requestAnimationFrame(schleife)
    }

    aufbauen()

    if (wenigerBewegung) {
      zeichnen()
      setLaeuft(false)
    } else {
      schleife()
    }

    const beobachter = new IntersectionObserver(
      ([eintrag]) => {
        sichtbar = eintrag.isIntersecting
      },
      { threshold: 0 },
    )
    beobachter.observe(canvas)

    let neuAufbauZeit: ReturnType<typeof setTimeout>
    const beiGroesse = () => {
      clearTimeout(neuAufbauZeit)
      neuAufbauZeit = setTimeout(() => {
        aufbauen()
        zeichnen()
      }, 180)
    }
    window.addEventListener('resize', beiGroesse)

    return () => {
      cancelAnimationFrame(frame)
      beobachter.disconnect()
      window.removeEventListener('resize', beiGroesse)
      clearTimeout(neuAufbauZeit)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="hero-anim" aria-hidden="true" />
      <button
        type="button"
        className="figure__steuerung"
        onClick={() => setLaeuft((v) => !v)}
        aria-pressed={laeuft}
      >
        {laeuft ? 'Bewegung anhalten' : 'Bewegung starten'}
      </button>
    </>
  )
}

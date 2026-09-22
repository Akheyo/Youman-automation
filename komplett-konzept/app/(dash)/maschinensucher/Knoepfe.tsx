'use client'

/**
 * Die Knöpfe der Maschinensucher-Seite.
 *
 * Dasselbe Muster wie in components/Steuerung.tsx: Server Action in einer
 * Transition, Fehler an Ort und Stelle statt in der Konsole. Neu ist nur die
 * Rückfrage vor dem Herunternehmen — sie ist keine Höflichkeit: Ein Klick
 * nimmt ein Inserat vom Markt, und das merkt man erst am nächsten Morgen.
 */

import { useState, useTransition } from 'react'
import { abgleichJetzt, artikelKategorie, artikelMarkieren, rueckgangFreigeben } from './aktionen'

function useAktion() {
  const [laeuft, start] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  const ausfuehren = (fn: () => Promise<void>) => {
    setFehler(null)
    start(async () => {
      try {
        await fn()
      } catch (e) {
        setFehler(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.')
      }
    })
  }

  return { laeuft, fehler, ausfuehren }
}

function Fehlerzeile({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p className="meldung meldung--fehler klein" role="alert" style={{ width: '100%' }}>
      {text}
    </p>
  )
}

export function MarkierKnopf({
  id,
  markiert,
  draussen,
  darfSteuern,
}: {
  id: string
  markiert: boolean
  draussen: boolean
  darfSteuern: boolean
}) {
  const { laeuft, fehler, ausfuehren } = useAktion()

  const klick = () => {
    if (markiert) {
      const frage = draussen
        ? 'Vom Marktplatz nehmen? Beim nächsten Abgleich verschwindet das Inserat auf Maschinensucher.'
        : 'Markierung zurücknehmen?'
      if (!window.confirm(frage)) return
    }
    ausfuehren(() => artikelMarkieren(id, !markiert))
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn--klein ${markiert ? 'btn--gefahr' : 'btn--primaer'}`}
        onClick={klick}
        disabled={!darfSteuern || laeuft}
        title={darfSteuern ? undefined : 'Dafür fehlen dir die Rechte.'}
      >
        {laeuft ? '…' : markiert ? 'Herunternehmen' : 'Auf Maschinensucher'}
      </button>
      <Fehlerzeile text={fehler} />
    </>
  )
}

/**
 * Kategorie am Artikel.
 *
 * Steht hier etwas, gewinnt es gegen jede Zuordnung über Suchworte — wer sie
 * einträgt, hat in die Maschinensucher-Rubrikliste gesehen.
 */
export function KategorieFeld({
  id,
  wert,
  darfSteuern,
}: {
  id: string
  wert: string
  darfSteuern: boolean
}) {
  const { laeuft, fehler, ausfuehren } = useAktion()
  const [eingabe, setEingabe] = useState(wert)

  return (
    <>
      <input
        type="text"
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
        onBlur={() => {
          if (eingabe.trim() !== wert.trim()) ausfuehren(() => artikelKategorie(id, eingabe))
        }}
        disabled={!darfSteuern || laeuft}
        placeholder="Rubrik"
        aria-label="Maschinensucher-Kategorie"
        style={{ minHeight: 30, width: '8rem', fontSize: '12.5px' }}
      />
      <Fehlerzeile text={fehler} />
    </>
  )
}

export function FreigabeKnopf({ darfSteuern }: { darfSteuern: boolean }) {
  const { laeuft, fehler, ausfuehren } = useAktion()

  return (
    <>
      <button
        type="button"
        className="btn btn--klein btn--gefahr"
        disabled={!darfSteuern || laeuft}
        onClick={() => {
          if (!window.confirm('Rückgang freigeben? Die nächste Abholung nimmt die fehlenden Inserate vom Marktplatz.')) {
            return
          }
          ausfuehren(() => rueckgangFreigeben())
        }}
      >
        {laeuft ? '…' : 'Rückgang freigeben'}
      </button>
      <Fehlerzeile text={fehler} />
    </>
  )
}

export function AbgleichKnopf({ darfSteuern, vonVorn = false }: { darfSteuern: boolean; vonVorn?: boolean }) {
  const { laeuft, fehler, ausfuehren } = useAktion()

  return (
    <>
      <button
        type="button"
        className={`btn btn--klein ${vonVorn ? '' : 'btn--primaer'}`}
        disabled={!darfSteuern || laeuft}
        onClick={() => ausfuehren(() => abgleichJetzt(vonVorn))}
        title={darfSteuern ? undefined : 'Dafür fehlen dir die Rechte.'}
      >
        {laeuft ? 'läuft …' : vonVorn ? 'Von vorn beginnen' : 'Jetzt abgleichen'}
      </button>
      <Fehlerzeile text={fehler} />
    </>
  )
}

/** Adresse zum Kopieren — sie ist zu lang, um sie abzutippen. */
export function AdressFeld({ adresse }: { adresse: string }) {
  const [kopiert, setKopiert] = useState(false)

  return (
    <div style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={adresse}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Abholadresse für Maschinensucher"
        style={{ flex: '1 1 26rem', fontFamily: 'var(--mono)', fontSize: '12px', minHeight: 34 }}
      />
      <button
        type="button"
        className="btn btn--klein"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(adresse)
            setKopiert(true)
            window.setTimeout(() => setKopiert(false), 2500)
          } catch {
            setKopiert(false)
          }
        }}
      >
        {kopiert ? 'Kopiert' : 'Adresse kopieren'}
      </button>
    </div>
  )
}

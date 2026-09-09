'use client'

import { useState, useTransition } from 'react'
import {
  alleFehlerErledigen,
  automationJetztAusfuehren,
  automationUmschalten,
  fehlerStatusSetzen,
  laufAbbrechen,
  laufWiederholen,
} from '@/app/(dash)/steuerung'
import { IconHaken, IconPause, IconStart, IconStop, IconWiederholen } from './Icons'
import type { AusfuehrungStatus, AutomationStatus, FehlerStatus } from '@/lib/types'

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

// ---------------------------------------------------------------------------
export function AutomationSteuerung({
  id,
  status,
  darfSteuern,
  klein = false,
}: {
  id: string
  status: AutomationStatus
  darfSteuern: boolean
  klein?: boolean
}) {
  const { laeuft, fehler, ausfuehren } = useAktion()
  const groesse = klein ? ' btn--klein' : ''
  const aktiv = status === 'active'

  return (
    <div className="btn-reihe">
      <button
        type="button"
        className={'btn btn--primaer' + groesse}
        disabled={!darfSteuern || laeuft}
        onClick={() => ausfuehren(() => automationJetztAusfuehren(id))}
        title={darfSteuern ? 'Lauf einreihen' : 'Dafür fehlen dir die Rechte'}
      >
        <IconStart size={14} />
        Jetzt ausführen
      </button>

      <button
        type="button"
        className={'btn' + groesse}
        disabled={!darfSteuern || laeuft}
        onClick={() => ausfuehren(() => automationUmschalten(id, aktiv ? 'paused' : 'active'))}
      >
        {aktiv ? <IconPause size={14} /> : <IconStart size={14} />}
        {aktiv ? 'Pausieren' : 'Aktivieren'}
      </button>

      <Fehlerzeile text={fehler} />
    </div>
  )
}

// ---------------------------------------------------------------------------
export function LaufSteuerung({
  id,
  status,
  darfSteuern,
}: {
  id: string
  status: AusfuehrungStatus
  darfSteuern: boolean
}) {
  const { laeuft, fehler, ausfuehren } = useAktion()
  const abbrechbar = status === 'running' || status === 'queued'

  return (
    <div className="btn-reihe">
      <button
        type="button"
        className="btn btn--klein"
        disabled={!darfSteuern || laeuft || abbrechbar}
        onClick={() => ausfuehren(() => laufWiederholen(id))}
        title={abbrechbar ? 'Läuft noch' : 'Mit denselben Eingaben erneut einreihen'}
      >
        <IconWiederholen size={14} />
        Wiederholen
      </button>

      {abbrechbar ? (
        <button
          type="button"
          className="btn btn--klein btn--gefahr"
          disabled={!darfSteuern || laeuft}
          onClick={() => ausfuehren(() => laufAbbrechen(id))}
        >
          <IconStop size={13} />
          Abbrechen
        </button>
      ) : null}

      <Fehlerzeile text={fehler} />
    </div>
  )
}

// ---------------------------------------------------------------------------
export function FehlerSteuerung({
  id,
  status,
  darfSteuern,
}: {
  id: string
  status: FehlerStatus
  darfSteuern: boolean
}) {
  const { laeuft, fehler, ausfuehren } = useAktion()

  return (
    <div className="btn-reihe">
      {status !== 'resolved' ? (
        <>
          {status === 'open' ? (
            <button
              type="button"
              className="btn btn--klein"
              disabled={!darfSteuern || laeuft}
              onClick={() => ausfuehren(() => fehlerStatusSetzen(id, 'acknowledged'))}
            >
              Übernehmen
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--klein btn--erfolg"
            disabled={!darfSteuern || laeuft}
            onClick={() => ausfuehren(() => fehlerStatusSetzen(id, 'resolved'))}
          >
            <IconHaken size={13} />
            Erledigt
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn--klein"
          disabled={!darfSteuern || laeuft}
          onClick={() => ausfuehren(() => fehlerStatusSetzen(id, 'open'))}
        >
          Wieder öffnen
        </button>
      )}

      <Fehlerzeile text={fehler} />
    </div>
  )
}

// ---------------------------------------------------------------------------
export function AlleFehlerErledigen({ automationId, darfSteuern }: { automationId: string; darfSteuern: boolean }) {
  const { laeuft, fehler, ausfuehren } = useAktion()

  return (
    <div className="btn-reihe">
      <button
        type="button"
        className="btn btn--klein"
        disabled={!darfSteuern || laeuft}
        onClick={() => ausfuehren(() => alleFehlerErledigen(automationId))}
      >
        <IconHaken size={13} />
        Alle als erledigt markieren
      </button>
      <Fehlerzeile text={fehler} />
    </div>
  )
}

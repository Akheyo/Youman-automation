/**
 * Die Notbremse: ein plötzlich viel kürzerer Feed geht NICHT raus.
 *
 * Der automatische Import ist ein Abgleich, kein Hinzufügen. Was in der Datei
 * fehlt, verschwindet auf Maschinensucher. Das ist der Sinn der Sache — und
 * zugleich ihre gefährlichste Eigenschaft: Ein falscher Haken, ein Ausfall
 * der Preisrecherche oder ein Fehler in einer Bedingung, und die Nacht nimmt
 * den ganzen Bestand vom Markt. Niemand sieht es, weil es lautlos passiert:
 * Der Abruf war erfolgreich, die Datei war gültig, sie war nur leer.
 *
 * Deshalb: Fällt die Zahl der Inserate gegenüber der letzten erfolgreichen
 * Abholung stark ab, liefert der Feed lieber einen FEHLER. Ein fehlgeschlagener
 * Import lässt die bestehenden Inserate stehen — das ist die Richtung, in die
 * ein Irrtum fallen soll. Freigegeben wird der Rückgang dann von Hand, mit
 * einem Blick auf die Liste.
 *
 * Unter der Schwelle greift die Bremse nicht: Bei sechs Inseraten ist "nur
 * noch zwei" ein normaler Dienstag.
 */

/** Ab so vielen Inseraten in der letzten Datei wird überhaupt geprüft. */
export const RUECKGANG_SCHWELLE = 10

/** Unter diesem Anteil der letzten Menge gilt es als Einbruch. */
export const RUECKGANG_ANTEIL = 0.5

/** Wie lange eine Freigabe gilt — lang genug für eine Nacht, nicht länger. */
export const FREIGABE_STUNDEN = 12

export interface Rueckgangfrage {
  /** Inserate, die jetzt ausgeliefert würden. */
  jetzt: number
  /** Inserate der letzten erfolgreichen Abholung; null, wenn es keine gab. */
  zuletzt: number | null
  /** Bis wann ein Mensch den Rückgang freigegeben hat (ISO), falls überhaupt. */
  freiBis: string | null
  /** Jetztzeit — als Parameter, damit die Regel prüfbar bleibt. */
  zeitpunkt: Date
}

export interface Rueckgangbefund {
  blockiert: boolean
  /** Erklärt in einem Satz, was los ist — für Protokoll und Oberfläche. */
  meldung: string | null
  freigegeben: boolean
}

export function pruefeRueckgang({ jetzt, zuletzt, freiBis, zeitpunkt }: Rueckgangfrage): Rueckgangbefund {
  const freigegeben = Boolean(freiBis && new Date(freiBis).getTime() > zeitpunkt.getTime())

  if (zuletzt == null || zuletzt < RUECKGANG_SCHWELLE) return { blockiert: false, meldung: null, freigegeben }
  if (jetzt >= zuletzt * RUECKGANG_ANTEIL) return { blockiert: false, meldung: null, freigegeben }

  const meldung =
    `Rückgang: ${jetzt} statt zuletzt ${zuletzt} Inserate. Die Datei wird zurückgehalten, damit der ` +
    'Abgleich nicht den Bestand vom Markt nimmt. Auf der Seite Maschinensucher prüfen und freigeben.'

  return freigegeben ? { blockiert: false, meldung, freigegeben } : { blockiert: true, meldung, freigegeben }
}

/** Ende einer jetzt erteilten Freigabe. */
export function freigabeBis(zeitpunkt: Date): string {
  return new Date(zeitpunkt.getTime() + FREIGABE_STUNDEN * 3600 * 1000).toISOString()
}

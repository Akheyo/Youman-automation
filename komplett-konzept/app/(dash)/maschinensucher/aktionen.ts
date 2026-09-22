'use server'

/**
 * Die Steueraktionen der Maschinensucher-Seite.
 *
 * Alle vier ändern etwas, das nach außen sichtbar wird — deshalb braucht jede
 * mindestens die Rolle „Bediener", und jede schreibt ins Protokoll. Wer ein
 * Gerät auf den Marktplatz stellt oder wieder herunternimmt, trifft eine
 * Entscheidung über ein öffentliches Angebot; dass hinterher niemand mehr
 * weiß, wer es war, wäre die schlechtere Variante.
 */

import { revalidatePath } from 'next/cache'
import { rolleErzwingen } from '@/lib/auth'
import { protokollSchreiben } from '@/lib/queries'
import { aktuellerNutzer } from '@/lib/session'
import { kategorieSetzen, markieren } from '@/lib/maschinensucher/artikel'
import { freigabeSetzen, laufMelden } from '@/lib/maschinensucher/lauf'
import { freigabeBis } from '@/lib/maschinensucher/rueckgang'
import { abgleichLaufen } from '@/lib/plenty/sync'

async function bediener() {
  const nutzer = await aktuellerNutzer()
  rolleErzwingen(nutzer, 'operator')
  return nutzer
}

export async function artikelMarkieren(id: string, markiertSetzen: boolean) {
  const nutzer = await bediener()
  const anzahl = await markieren([id], markiertSetzen, nutzer.name)
  if (anzahl === 0) throw new Error('Artikel nicht gefunden.')

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: markiertSetzen ? 'maschinensucher.markiert' : 'maschinensucher.zurueckgenommen',
    targetType: 'artikel',
    targetId: id,
  })

  revalidatePath('/maschinensucher')
}

export async function artikelKategorie(id: string, kategorie: string) {
  const nutzer = await bediener()
  await kategorieSetzen(id, kategorie)

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'maschinensucher.kategorie',
    targetType: 'artikel',
    targetId: id,
    meta: { kategorie },
  })

  revalidatePath('/maschinensucher')
}

/**
 * Gibt einen zurückgehaltenen Rückgang frei (siehe rueckgang.ts).
 *
 * Die Freigabe läuft von selbst ab. Eine dauerhafte Abschaltung wäre keine
 * Sicherung mehr, sondern ein Schalter, den irgendwann niemand mehr umlegt.
 */
export async function rueckgangFreigeben() {
  const nutzer = await bediener()
  const bis = freigabeBis(new Date())
  await freigabeSetzen(bis)

  await protokollSchreiben({
    userId: nutzer.id,
    userName: nutzer.name,
    action: 'maschinensucher.rueckgang_freigegeben',
    targetType: 'automation',
    targetName: 'Maschinensucher holt die Inserate ab',
    meta: { bis },
  })

  revalidatePath('/maschinensucher')
}

/** Einen Abschnitt des Plenty-Abgleichs von Hand anstoßen. */
export async function abgleichJetzt(vonVorn = false) {
  const nutzer = await bediener()
  const beginn = new Date()

  try {
    const bericht = await abgleichLaufen({ vonVorn })
    await laufMelden({
      key: 'maschinensucher-sync',
      status: 'success',
      trigger: 'manual',
      startedAt: beginn,
      itemsProcessed: bericht.gespeichert,
      input: { vonSeite: bericht.vonSeite, vonVorn, durch: nutzer.name },
      output: {
        bisSeite: bericht.bisSeite,
        naechsteSeite: bericht.naechsteSeite,
        fertig: bericht.fertig,
        gelesen: bericht.gelesen,
        bilderGeholt: bericht.bilderGeholt,
        gesamtLautPlenty: bericht.gesamtLautPlenty,
      },
      logs: [
        {
          level: 'info',
          message:
            `Seiten ${bericht.vonSeite}–${bericht.bisSeite}: ${bericht.gespeichert} Artikel geschrieben, ` +
            `${bericht.bilderGeholt} Bildabrufe. Angestoßen von ${nutzer.name}.`,
        },
        ...bericht.diagnose.map((d) => ({ level: 'debug' as const, message: d })),
      ],
    })

    await protokollSchreiben({
      userId: nutzer.id,
      userName: nutzer.name,
      action: 'maschinensucher.abgleich_gestartet',
      targetType: 'automation',
      targetName: 'Plenty-Abgleich (Artikeldaten)',
      meta: { gespeichert: bericht.gespeichert, fertig: bericht.fertig },
    })

    revalidatePath('/maschinensucher')
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e)
    await laufMelden({
      key: 'maschinensucher-sync',
      status: 'failed',
      trigger: 'manual',
      startedAt: beginn,
      input: { vonVorn, durch: nutzer.name },
      fehler: { message: meldung, code: 'PLENTY' },
    })
    revalidatePath('/maschinensucher')
    // Weiterwerfen, damit die Oberfläche es am Knopf sagt und nicht nur im
    // Fehlerbereich steht.
    throw new Error(meldung)
  }
}

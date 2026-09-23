'use server'

/**
 * Die Steueraktionen der Maschinensucher-Seite.
 *
 * Alle drei ändern etwas, das nach außen sichtbar wird — deshalb braucht jede
 * mindestens die Rolle „Bediener", und jede schreibt ins Protokoll.
 *
 * Was hier NICHT steht: markieren. Ob ein Gerät auf den Marktplatz geht,
 * entscheidet die Markierung „Maschinensucher" am Artikel in PlentyONE. Ein
 * zweiter Schalter hier hätte sich mit ihr überworfen — der nächste Abgleich
 * hätte ihn wieder gerade gebogen, und niemand hätte verstanden, warum ein
 * Gerät zurück auf den Markt geht.
 */

import { revalidatePath } from 'next/cache'
import { rolleErzwingen } from '@/lib/auth'
import { protokollSchreiben } from '@/lib/queries'
import { aktuellerNutzer } from '@/lib/session'
import { kategorieSetzen } from '@/lib/maschinensucher/artikel'
import { freigabeSetzen, laufMelden } from '@/lib/maschinensucher/lauf'
import { freigabeBis } from '@/lib/maschinensucher/rueckgang'
import { abgleichLaufen } from '@/lib/plenty/sync'
import { bestandAbgleichen } from '@/lib/plenty/bestand'

async function bediener() {
  const nutzer = await aktuellerNutzer()
  rolleErzwingen(nutzer, 'operator')
  return nutzer
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

/**
 * Bestände jetzt abgleichen.
 *
 * Der Lauf, der Artikel vom Marktplatz nimmt: Was keinen Bestand mehr hat,
 * fällt aus der nächsten Importdatei. Deshalb steht der Knopf auf der Seite
 * und nicht nur im Zeitplan — wenn gerade etwas verkauft wurde, will man
 * nicht bis zur nächsten vollen Stunde warten.
 */
export async function bestandJetzt() {
  const nutzer = await bediener()
  const beginn = new Date()

  try {
    const bericht = await bestandAbgleichen()
    await laufMelden({
      key: 'maschinensucher-bestand',
      status: 'success',
      trigger: 'manual',
      startedAt: beginn,
      itemsProcessed: bericht.aktualisiert,
      input: { durch: nutzer.name },
      output: {
        gelesen: bericht.gelesen,
        varianten: bericht.varianten,
        aufNull: bericht.aufNull,
        vollstaendig: bericht.vollstaendig,
      },
      logs: [
        {
          level: 'info',
          message:
            `${bericht.varianten} Varianten mit Bestand gelesen, ${bericht.aktualisiert} Artikel aktualisiert.` +
            (bericht.aufNull > 0 ? ` ${bericht.aufNull} markierte stehen jetzt auf 0.` : '') +
            ` Angestoßen von ${nutzer.name}.`,
        },
        ...bericht.hinweise.map((h) => ({ level: 'warn' as const, message: h })),
      ],
      fehler:
        bericht.hinweise.length > 0
          ? { message: bericht.hinweise.join(' '), code: 'BESTAND', severity: 'warning' as const }
          : undefined,
    })

    await protokollSchreiben({
      userId: nutzer.id,
      userName: nutzer.name,
      action: 'maschinensucher.bestand_gestartet',
      targetType: 'automation',
      targetName: 'Bestandsabgleich',
      meta: { aktualisiert: bericht.aktualisiert, aufNull: bericht.aufNull },
    })

    revalidatePath('/maschinensucher')
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e)
    await laufMelden({
      key: 'maschinensucher-bestand',
      status: 'failed',
      trigger: 'manual',
      startedAt: beginn,
      input: { durch: nutzer.name },
      fehler: { message: meldung, code: 'PLENTY' },
    })
    revalidatePath('/maschinensucher')
    throw new Error(meldung)
  }
}

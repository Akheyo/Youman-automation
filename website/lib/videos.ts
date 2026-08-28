/**
 * Videoregister — analog zum Bildregister.
 *
 * Solange `datei` leer ist, zeigt die Seite einen markierten Platzhalter mit
 * Motiv, Länge und technischen Vorgaben. Ein Video einsetzen:
 *   1. MP4 (H.264) nach `public/videos/` legen, optional zusätzlich WebM
 *   2. Standbild nach `public/bilder/` legen
 *   3. hier `datei` und `standbild` eintragen
 */

export type Video = {
  /** Was zu sehen sein soll. Erscheint im Platzhalter. */
  motiv: string
  /** Beschreibung für Menschen, die das Video nicht sehen können. */
  beschreibung: string
  verhaeltnis: '16/9' | '4/3' | '3/2' | '21/9'
  /** Empfohlene Länge in Sekunden. Kurze Schleifen wirken ruhiger. */
  laenge: string
  /** Pfad unter public/, sobald ein Video vorliegt. */
  datei?: string
  /** Zusätzliche WebM-Fassung, deutlich kleiner als MP4. */
  dateiWebm?: string
  /** Standbild: wird vor dem Start und bei reduzierter Bewegung gezeigt. */
  standbild?: string
}

export const videos = {
  hero: {
    motiv:
      'Ruhige Schleife ohne Ton: Blick in Lager, Halle oder Büro während der Arbeit. Wenige, langsame Bewegungen — Kamera möglichst statisch oder mit sanfter Fahrt. Keine Schnittgewitter, keine Musik nötig.',
    beschreibung:
      'Aufnahmen aus dem Arbeitsalltag: Waren werden kommissioniert, Daten laufen über Bildschirme, Mitarbeitende arbeiten an verbundenen Systemen.',
    verhaeltnis: '4/3',
    laenge: '8–15 Sekunden, nahtlose Schleife',
  },
} satisfies Record<string, Video>

export type VideoKey = keyof typeof videos


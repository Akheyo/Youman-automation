/**
 * Bildregister.
 *
 * Jede Bildstelle der Website steht hier mit Motivbeschreibung, Seitenverhältnis
 * und empfohlenen Maßen. Solange `datei` leer ist, zeigt die Seite einen
 * markierten Platzhalter, der genau diese Angaben nennt — dadurch weiß jede
 * Person, die Bilder liefert, was gebraucht wird, ohne den Code zu lesen.
 *
 * Ein Bild einsetzen:
 *   1. Datei nach `public/bilder/` legen
 *   2. hier `datei: '/bilder/dateiname.webp'` eintragen
 * Der Platzhalter verschwindet automatisch, das Layout bleibt gleich, weil das
 * Seitenverhältnis vorab reserviert ist.
 */

export type Seitenverhaeltnis = '16/9' | '4/3' | '3/2' | '1/1' | '4/5' | '21/9'

export type Bild = {
  /** Was auf dem Bild zu sehen sein soll. Erscheint im Platzhalter. */
  motiv: string
  /** Alternativtext für das fertige Bild. Beschreibt den Inhalt, nicht das Motiv-Briefing. */
  alt: string
  verhaeltnis: Seitenverhaeltnis
  /** Empfohlene Breite in Pixeln für die größte Darstellung. */
  breite: number
  /** Pfad unter public/, sobald ein Bild vorliegt. */
  datei?: string
  /**
   * Zusätzlich akzeptierte Dateinamen. Niemand soll sich Schlüssel wie
   * `brancheGrosshandel` merken müssen — `Großhandel & Distribution.png`
   * oder `grosshandel.jpg` findet die Seite genauso.
   */
  namen?: string[]
}

export const bilder = {
  heroStart: {
    motiv:
      'Querformat, Blick in ein Büro oder eine Halle während der Arbeit. Keine gestellten Stockfotos mit Daumen hoch — echte Arbeitssituation, ruhige Farben.',
    alt: 'Mitarbeitende arbeiten an verbundenen Systemen im Betrieb',
    verhaeltnis: '4/3',
    breite: 1200,
    namen: ['hero', 'startseite', 'start'],
  },

  branchenUebersicht: {
    motiv: 'Breites Panorama, das mehrere Branchen andeutet — Lager, Halle, Bildschirmarbeit.',
    alt: 'Verschiedene Arbeitsumgebungen aus Handel, Logistik und Produktion',
    verhaeltnis: '21/9',
    breite: 1600,
    namen: ['branchen', 'branchenuebersicht', 'branchen übersicht'],
  },

  // --- Branchen ---
  brancheECommerce: {
    motiv: 'Versandlager mit Kartons und Packplatz, im Hintergrund Bildschirme mit Bestellübersicht.',
    alt: 'Packplatz in einem Versandlager mit Bestellübersicht am Bildschirm',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['ecommerce', 'e-commerce', 'onlinehandel', 'e-commerce & onlinehandel'],
  },
  brancheLogistik: {
    motiv: 'LKW an einer Verladerampe oder Disposition mit Tourenübersicht am Bildschirm.',
    alt: 'Lastwagen an der Verladerampe einer Spedition',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['spedition', 'logistik', 'spedition & logistik'],
  },
  brancheProduktion: {
    motiv: 'Fertigungshalle mit Maschine und Bedienterminal, Person bei der Rückmeldung.',
    alt: 'Bedienterminal an einer Maschine in der Fertigung',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['produktion', 'fertigung', 'produktion & fertigung'],
  },
  brancheGrosshandel: {
    motiv: 'Hochregallager oder Innendienst am Telefon mit Artikelliste am Bildschirm.',
    alt: 'Hochregallager eines Großhändlers',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['grosshandel', 'großhandel', 'distribution', 'großhandel & distribution'],
  },
  brancheHandwerk: {
    motiv: 'Handwerkerin oder Handwerker auf der Baustelle, Tablet oder Handy in der Hand.',
    alt: 'Person dokumentiert eine Baustelle mit dem Tablet',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['handwerk', 'bau', 'handwerk & bau'],
  },
  brancheDienstleistung: {
    motiv: 'Kleines Team im Besprechungsraum vor einem Board, konzentriert statt gestellt.',
    alt: 'Team im Besprechungsraum vor einem Projektboard',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['dienstleistung', 'agenturen', 'dienstleistung & agenturen'],
  },

  // --- Leistungen ---
  leistungAutomation: {
    motiv: 'Bildschirm mit einem Workflow-Diagramm, unscharfer Arbeitsplatz dahinter.',
    alt: 'Workflow-Diagramm auf einem Bildschirm',
    verhaeltnis: '4/3',
    breite: 900,
    namen: ['leistungautomation', 'automation', 'automationen', 'ki-automationen'],
  },
  leistungChatbot: {
    motiv: 'Chatverlauf auf einem Gerät, im Hintergrund ein Serviceplatz.',
    alt: 'Chatverlauf eines Serviceassistenten auf einem Gerät',
    verhaeltnis: '4/3',
    breite: 900,
    namen: ['leistungchatbot', 'chatbot', 'chatbots', 'ki-chatbots'],
  },
  leistungWebsite: {
    motiv: 'Website auf Laptop und Handy nebeneinander, neutraler Schreibtisch.',
    alt: 'Website auf Laptop und Smartphone',
    verhaeltnis: '4/3',
    breite: 900,
    namen: ['leistungwebsite', 'websites', 'moderne websites'],
  },
  leistungEcommerce: {
    motiv: 'Bildschirm mit Bestandsübersicht mehrerer Verkaufskanäle.',
    alt: 'Bestandsübersicht mehrerer Verkaufskanäle auf einem Bildschirm',
    verhaeltnis: '4/3',
    breite: 900,
    namen: ['leistungecommerce', 'e-commerce-loesungen', 'e-commerce-lösungen'],
  },

  // --- Referenzprojekte ---
  refMarktplatz: {
    motiv: 'Lagerbestand und Bildschirm mit Kanalübersicht nebeneinander.',
    alt: 'Lagerbestand und Kanalübersicht am Bildschirm',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['marktplatz', 'marktplatz-synchronisation'],
  },
  refChatbot: {
    motiv: 'Serviceplatz mit Chatfenster und Wissensdatenbank.',
    alt: 'Serviceplatz mit geöffnetem Chatfenster',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['ki-kundenservice', 'kundenservice', 'refkundenservice'],
  },
  refVoice: {
    motiv: 'Person diktiert unterwegs eine Notiz ins Handy, im Auto oder auf dem Weg.',
    alt: 'Person spricht eine Notiz ins Smartphone',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['voice', 'sprachnotiz', 'voice-to-task'],
  },
  refWebsite: {
    motiv: 'Fertige Website auf einem Bildschirm, daneben eine Anfrageübersicht.',
    alt: 'Website und zugehörige Anfrageübersicht',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['refwebsite', 'unternehmenswebsite'],
  },

  refDrahtmueller: {
    motiv:
      'Gitterroste oder Drahtgitter-Paletten in einer Halle, gestapelt. Alternativ Blick auf einen Versandbereich mit unterschiedlichen Palettenmaßen.',
    alt: 'Gestapelte Gitterpaletten in einer Fertigungshalle',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['drahtmueller', 'drahtmüller', 'paletten', 'palettenoptimierung'],
  },
  refSolar: {
    motiv:
      'Photovoltaik-Baustelle oder Lager mit Solarmodulen und Wechselrichtern, Monteure bei der Arbeit.',
    alt: 'Photovoltaik-Module auf einer Baustelle',
    verhaeltnis: '16/9',
    breite: 1200,
    namen: ['solar', 'absolar', 'photovoltaik', 'pv'],
  },

  statement: {
    motiv:
      'Querformat, sehr breit. Ruhiger Arbeitsplatz oder Halle, eher dunkel belichtet — das Bild wird abgedunkelt und mit weißer Schrift überlagert. Motiv links freilassen, dort steht der Text.',
    alt: 'Arbeitsplatz mit zwei Bildschirmen vor einer Produktionshalle',
    verhaeltnis: '21/9',
    breite: 1800,
    namen: ['aussage', 'band'],
  },

  // --- Über uns / Kontakt ---
  portrait: {
    motiv:
      'Professionelles Porträt vor neutralem Hintergrund oder am Arbeitsplatz. Hochformat, freundlich, kein Bewerbungsfoto-Look.',
    alt: 'Porträt des Gründers von Youman',
    verhaeltnis: '4/5',
    breite: 800,
    namen: ['portraet', 'porträt', 'foto', 'profilfoto'],
  },
  arbeitsweise: {
    motiv: 'Arbeitsplatz mit zwei Bildschirmen, Code und Diagramm sichtbar.',
    alt: 'Arbeitsplatz mit Code und Prozessdiagramm auf zwei Bildschirmen',
    verhaeltnis: '3/2',
    breite: 1000,
    namen: ['arbeitsplatz', 'ueberuns', 'über uns'],
  },
  kontakt: {
    motiv: 'Ruhige Aufnahme eines Besprechungstischs oder Telefonats.',
    alt: 'Besprechungstisch vor einem Gespräch',
    verhaeltnis: '3/2',
    breite: 1000,
    namen: ['kontaktbild'],
  },
} satisfies Record<string, Bild>

export type BildKey = keyof typeof bilder

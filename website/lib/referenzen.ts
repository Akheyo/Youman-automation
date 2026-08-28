import type { BildKey } from './bilder'

/**
 * Referenzprojekte. Bewusst ohne erfundene Kennzahlen: was hier steht, ist die
 * Beschreibung des gebauten Systems. Konkrete Zahlen und Kundennamen gehören
 * erst hinein, wenn der jeweilige Auftraggeber sie freigegeben hat.
 */

export type Referenz = {
  slug: string
  title: string
  /** Kurzzeile für Kacheln. */
  teaser: string
  metaTitle: string
  metaDescription: string
  /** Branche als Label — verweist auf den passenden Slug in branchen.ts. */
  brancheSlug?: string
  brancheLabel: string
  /** Was vorher galt. */
  ausgangslage: string[]
  /** Was gebaut wurde. */
  vorgehen: { title: string; text: string }[]
  /** Was sich dadurch geändert hat — qualitativ, nicht behauptet quantitativ. */
  ergebnis: string[]
  stack: string[]
  /** Schlüssel aus dem Bildregister. */
  bild: BildKey
  /** Kundenname, sofern die Nennung freigegeben ist. */
  kunde?: string
  /**
   * Die eine belegte Zahl, die den Fall trägt. Nur setzen, wenn sie aus
   * Projektunterlagen stammt — eine geschätzte Zahl ist schlechter als keine.
   */
  kennzahl?: { wert: string; beschreibung: string }
}

export const referenzen: Referenz[] = [
  {
    slug: 'drahtmueller-palettenoptimierung',
    bild: 'refDrahtmueller',
    title: 'Palettenoptimierung bei Drahtmüller',
    teaser:
      '2.556 aktive Palettentypen, jede Entscheidung ein Einzelfall — abgebildet als Modul am bestehenden ERP.',
    metaTitle: 'Referenz: Palettenoptimierung in der Fertigung mit ERP-Anbindung',
    metaDescription:
      'Wie die Entscheidung zwischen Standard- und Sonderpaletten aus den Auftragsdaten abgeleitet und an das bestehende ERP-System angebunden wurde — ohne Systemablösung.',
    brancheSlug: 'produktion-und-fertigung',
    brancheLabel: 'Fertigung und Logistik',
    kunde: 'Drahtmüller GmbH / Lichtgitter-Gruppe',
    kennzahl: { wert: '2.556', beschreibung: 'Palettentypen waren aktiv im Einsatz' },
    ausgangslage: [
      'Bei jeder neuen Auftragssituation entstand hoher Planungsaufwand.',
      'Wiederkehrende Palettenmaße waren nicht standardisiert.',
      'Beschaffung und Disposition waren durch 2.556 aktive Palettentypen entsprechend komplex.',
      'Zwischen Auftragseingang und Palettenplanung bestand keine direkte Verbindung im ERP-System.',
    ],
    vorgehen: [
      {
        title: 'Analyse',
        text: 'Der Weg vom Auftragseingang bis zur Palettenentscheidung wurde vollständig aufgenommen: Auftragsdaten, Entscheidungsregeln, Maßlogiken und die Schnittstellen im laufenden Betrieb.',
      },
      {
        title: 'Konzept',
        text: 'Daraus entstand ein Lösungsentwurf, der die fachliche Logik für Standard- und Sonderpaletten ebenso berücksichtigt wie die technische Einbettung in die vorhandene ERP-Landschaft.',
      },
      {
        title: 'Entwicklung',
        text: 'Umgesetzt wurde nicht eine allgemeine Standardfunktion, sondern die präzise Abbildung des tatsächlichen Fachprozesses als eigenes Modul.',
      },
      {
        title: 'Integration',
        text: 'Das Modul wurde an das ERP angebunden: Auftragsdaten werden automatisch übernommen, verarbeitet und in den bestehenden Prozess zurückgegeben.',
      },
    ],
    ergebnis: [
      'Aus den Auftragsdaten wird abgeleitet, welche Standardpaletten verwendbar sind.',
      'Ebenso, welche Sonderpaletten gefertigt werden müssen und wie viele Einheiten je Typ nötig sind.',
      'Die Entscheidung hängt nicht mehr an der Erfahrung einzelner Personen.',
    ],
    stack: ['ERP-Anbindung', 'REST API', 'Regelwerk', 'Individualmodul'],
  },
  {
    slug: 'absolar-warenwirtschaft',
    bild: 'refSolar',
    title: 'Warenwirtschaft für Solarprojekte',
    teaser:
      'Angebote, Lager und Baustellenplanung liefen getrennt — jetzt als ein Prozess von der Anfrage bis zur Baustelle.',
    metaTitle: 'Referenz: Warenwirtschaftssystem für Photovoltaik-Projekte',
    metaDescription:
      'Wie aus getrennten Ständen in Lexware Office, einer eigenen Lagerdatenbank und der Baustellenplanung ein durchgängiger Prozess wurde — mit Anbindung an die Lexware-Office-API.',
    brancheSlug: 'handwerk-und-bau',
    brancheLabel: 'Photovoltaik',
    kunde: 'A&B SolarEnergy',
    ausgangslage: [
      'Zwischen Angebot, Auftrag, Lager und Baustelle bestand keine zentrale Verbindung.',
      'Kunden-, Projekt- und Materialinformationen wurden mehrfach gepflegt.',
      'Die Übersicht über verfügbares und benötigtes Material war erschwert.',
      'Zwischen Datenbank und kaufmännischem System konnten Abweichungen entstehen.',
      'Die Vorbereitung von Baustellen kostete manuellen Abstimmungsaufwand.',
    ],
    vorgehen: [
      {
        title: 'Zentrale Datenbasis',
        text: 'Kunden-, Projekt-, Angebots- und Materialinformationen werden in einer verbundenen Struktur geführt statt in getrennten Ständen.',
      },
      {
        title: 'Lexware-Office-Anbindung',
        text: 'Angebote, Kontakte und weitere kaufmännische Informationen werden über die öffentliche API von Lexware Office ausgetauscht.',
      },
      {
        title: 'Automatische Projektübernahme',
        text: 'Wird ein Angebot angenommen oder ein Auftrag bestätigt, entsteht daraus automatisch das Projekt mit dem zugehörigen Materialbedarf.',
      },
      {
        title: 'Baustellenplanung',
        text: 'Benötigte Komponenten und Mengen werden dem Projekt zugeordnet; Bestände und Projektstatus aktualisieren sich mit.',
      },
    ],
    ergebnis: [
      'Ein Ablauf von der Angebotserstellung bis zur Baustelle statt drei getrennter Systeme.',
      'Materialbedarf je Projekt ist einsehbar, statt zusammengesucht zu werden.',
      'Kaufmännische Daten bleiben mit dem Warenwirtschaftssystem synchron.',
    ],
    stack: ['Lexware Office API', 'Datenbank', 'Warenwirtschaft', 'Projektlogik'],
  },
  {
    slug: 'marktplatz-synchronisation',
    bild: 'refMarktplatz',
    title: 'Marktplatz-Synchronisation',
    teaser:
      'Bestände und Preise über Shop, eBay und Amazon in einem Fluss statt in drei Nachtläufen.',
    metaTitle: 'Referenz: Bestands- und Preissynchronisation über mehrere Marktplätze',
    metaDescription:
      'Wie Bestände, Preise und Bestellungen zwischen PlentyONE, eBay und Shopify automatisch synchron gehalten werden — inklusive Fehlerbehandlung und Überwachung.',
    brancheSlug: 'e-commerce',
    brancheLabel: 'E-Commerce & Onlinehandel',
    ausgangslage: [
      'Ein Artikelbestand, drei Verkaufskanäle und ein nächtlicher Abgleich dazwischen.',
      'Überverkäufe traten regelmäßig auf, weil der Bestand tagsüber nicht nachgeführt wurde.',
      'Preisänderungen wurden je Kanal von Hand gepflegt, mit entsprechendem Zeitaufwand und Abweichungen.',
      'Fiel ein Abgleich aus, fiel es erst am Folgetag auf.',
    ],
    vorgehen: [
      {
        title: 'Ein führender Bestand',
        text: 'PlentyONE wurde als führendes System festgelegt. Alle Kanäle lesen von dort, statt eigene Stände zu halten.',
      },
      {
        title: 'Ereignisse statt Zeitplan',
        text: 'Jeder Verkauf löst per Webhook eine Aktualisierung aus. Der Nachtlauf blieb als Sicherheitsnetz erhalten, ist aber nicht mehr der Hauptweg.',
      },
      {
        title: 'Preisregeln zentral',
        text: 'Kanalaufschläge und Aktionen wurden als Regelwerk abgebildet. Eine Änderung an der Basis wirkt überall.',
      },
      {
        title: 'Fehler mit Warteschlange',
        text: 'Schlägt eine Übertragung fehl, wandert sie in eine Warteschlange und wird mit wachsendem Abstand wiederholt. Bleibt sie liegen, geht eine Meldung raus.',
      },
    ],
    ergebnis: [
      'Bestandsänderungen erreichen die Kanäle innerhalb von Sekunden bis wenigen Minuten statt am nächsten Morgen.',
      'Preispflege findet an einer Stelle statt, nicht mehr pro Kanal.',
      'Ausfälle werden gemeldet, statt entdeckt zu werden.',
    ],
    stack: ['n8n', 'PlentyONE', 'eBay API', 'Shopify', 'Webhooks'],
  },
  {
    slug: 'ki-kundenservice',
    bild: 'refChatbot',
    title: 'KI-Kundenservice mit Wissensbasis',
    teaser:
      'Ein Chatbot, der aus den eigenen Dokumenten antwortet und sauber an Menschen übergibt.',
    metaTitle: 'Referenz: KI-Chatbot mit RAG-Wissensdatenbank im Kundenservice',
    metaDescription:
      'Wie ein Chatbot mit Retrieval Augmented Generation Standardanfragen aus den eigenen Dokumenten beantwortet, unsichere Fälle eskaliert und dabei messbar bleibt.',
    brancheSlug: 'grosshandel-und-distribution',
    brancheLabel: 'Großhandel & Distribution',
    ausgangslage: [
      'Ein großer Teil der Anfragen waren wiederkehrende Fragen zu Verfügbarkeit, Versand und Konditionen.',
      'Die Antworten standen in Dokumenten, die niemand durchsuchen wollte.',
      'Ein früherer, regelbasierter Chatbot scheiterte an jeder Formulierung, die nicht vorgesehen war.',
    ],
    vorgehen: [
      {
        title: 'Wissensbasis statt Skript',
        text: 'Die vorhandenen Dokumente wurden aufbereitet und durchsuchbar gemacht. Der Bot antwortet aus diesen Quellen, nicht aus allgemeinem Modellwissen.',
      },
      {
        title: 'Belegte Antworten',
        text: 'Jede Antwort führt auf die Passage zurück, aus der sie stammt. Findet sich keine Grundlage, sagt der Bot das, statt zu raten.',
      },
      {
        title: 'Übergabe an Menschen',
        text: 'Bei Unsicherheit, Beschwerden oder ausdrücklichem Wunsch übernimmt ein Mitarbeitender — mit dem bisherigen Verlauf im Blick.',
      },
      {
        title: 'Auswertung im Betrieb',
        text: 'Welche Fragen kommen, welche laufen ins Leere, wo wird eskaliert — sichtbar in einem Dashboard, damit die Wissensbasis gezielt wächst.',
      },
    ],
    ergebnis: [
      'Wiederkehrende Fragen werden ohne Zutun des Teams beantwortet.',
      'Antworten sind auf eine Quelle zurückführbar und damit überprüfbar.',
      'Lücken in der Wissensbasis werden sichtbar, statt als schlechte Antworten unterzugehen.',
    ],
    stack: ['Claude API', 'Groq', 'RAG', 'Vektorsuche', 'Analytics-Dashboard'],
  },
  {
    slug: 'voice-to-task',
    bild: 'refVoice',
    title: 'Sprachnotiz zu strukturierter Aufgabe',
    teaser:
      'Unterwegs diktiert, im Projektmanagement als saubere Aufgabe angelegt — mit Priorität und Zuordnung.',
    metaTitle: 'Referenz: Sprachnotizen automatisch in strukturierte Aufgaben überführen',
    metaDescription:
      'Wie diktierte Notizen per Webhook erfasst, transkribiert, inhaltlich eingeordnet und automatisch als Aufgabe im Projektmanagement angelegt werden.',
    brancheSlug: 'dienstleistung-und-agenturen',
    brancheLabel: 'Dienstleistung & Agenturen',
    ausgangslage: [
      'Aufgaben entstanden unterwegs, im Gespräch oder auf der Fahrt — und wurden dort notiert, wo es gerade ging.',
      'Die Übertragung ins Projektmanagement passierte abends oder gar nicht.',
      'Was übertragen wurde, war unterschiedlich formuliert und schwer auswertbar.',
    ],
    vorgehen: [
      {
        title: 'Erfassung ohne Hürde',
        text: 'Eine Sprachnotiz wird aufgenommen und per Webhook übergeben. Kein Login, keine App, kein Formular.',
      },
      {
        title: 'Transkription und Einordnung',
        text: 'Der Text wird transkribiert und anschließend inhaltlich zerlegt: Was ist die Aufgabe, wer ist gemeint, wie dringend ist es, gehört es zu einem laufenden Projekt.',
      },
      {
        title: 'Strukturierte Anlage',
        text: 'Die Aufgabe entsteht mit Titel, Beschreibung, Zuordnung und Fälligkeit — im gleichen Format wie jede andere Aufgabe.',
      },
      {
        title: 'Rückmeldung',
        text: 'Eine kurze Bestätigung zeigt, was angelegt wurde. Missverständnisse fallen sofort auf, nicht Tage später.',
      },
    ],
    ergebnis: [
      'Gedanken landen dort, wo sie bearbeitet werden, statt in einer Notiz-App zu versanden.',
      'Aufgaben sind einheitlich strukturiert und damit auswertbar.',
      'Die abendliche Nacharbeit entfällt.',
    ],
    stack: ['Make.com', 'Claude API', 'Webhooks', 'Projektmanagement-API'],
  },
  {
    slug: 'unternehmenswebsite',
    bild: 'refWebsite',
    title: 'Unternehmenswebsite mit Anfragestrecke',
    teaser:
      'Schnelle, barrierearme Website, deren Anfragen direkt im Vertriebsprozess landen.',
    metaTitle: 'Referenz: Unternehmenswebsite mit angebundener Anfragestrecke',
    metaDescription:
      'Wie eine Unternehmenswebsite mit sauberem SEO-Fundament, guten Core Web Vitals und einer Anfragestrecke gebaut wird, die direkt an den Vertriebsprozess anschließt.',
    brancheSlug: 'produktion-und-fertigung',
    brancheLabel: 'Produktion & Fertigung',
    ausgangslage: [
      'Die bestehende Seite war langsam, auf dem Handy mühsam und in der Suche kaum auffindbar.',
      'Anfragen kamen als E-Mail an ein Sammelpostfach und wurden von Hand verteilt.',
      'Inhalte zu pflegen setzte technische Kenntnisse voraus, die im Haus niemand hatte.',
    ],
    vorgehen: [
      {
        title: 'Struktur vor Gestaltung',
        text: 'Zuerst wurde festgelegt, welche Seiten welchen Suchintent bedienen und wie sie zusammenhängen. Erst danach ging es um das Aussehen.',
      },
      {
        title: 'Technisches Fundament',
        text: 'Serverseitig gerendert, Schriften mit ausgeliefert, Bilder in modernen Formaten. Metadaten, strukturierte Daten und Sitemap von Anfang an korrekt.',
      },
      {
        title: 'Anfragen im Prozess',
        text: 'Das Formular schreibt nicht in ein Postfach, sondern übergibt an den Vertriebsprozess — mit Zuordnung und Benachrichtigung.',
      },
      {
        title: 'Pflegbar ohne Technik',
        text: 'Inhalte liegen an einer Stelle und lassen sich ändern, ohne Code anzufassen.',
      },
    ],
    ergebnis: [
      'Die Seite lädt schnell und ist auf dem Handy vollständig bedienbar.',
      'Anfragen landen strukturiert im Prozess statt in einem Sammelpostfach.',
      'Inhaltliche Änderungen brauchen keine Entwicklerin und keinen Entwickler.',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'strukturierte Daten'],
  },
]

export function getReferenz(slug: string) {
  return referenzen.find((r) => r.slug === slug)
}

export function referenzFuerBranche(brancheSlug: string) {
  return referenzen.find((r) => r.brancheSlug === brancheSlug)
}

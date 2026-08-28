/**
 * Branchenseiten bilden das SEO-Cluster: /branchen ist der Hub, jede Branche
 * eine Spoke-Seite mit eigenem Suchintent. Painpoints sind bewusst konkret und
 * in der Sprache der Betroffenen formuliert — wer sein eigenes Problem
 * wiedererkennt, liest weiter.
 */

export type Branche = {
  slug: string
  /** Sichtbarer Name in Navigation und Überschrift. */
  title: string
  /** Kurzzeile für Kacheln und Übersicht. */
  teaser: string
  /** Suchtitel: der Branchenname allein trägt selten genug Suchvolumen. */
  metaTitle: string
  metaDescription: string
  keywords: string[]
  /** Einordnung: warum diese Branche besonders von Automatisierung profitiert. */
  intro: string
  /** Operative Probleme, die auf dieser Seite adressiert werden. */
  painpoints: string[]
  /** Was konkret automatisiert wird — der Lösungsteil. */
  loesungen: { title: string; text: string }[]
  /** Typische Systeme in dieser Branche. */
  systeme: string[]
  /** Slug aus referenzen.ts, sofern ein passendes Projekt vorliegt. */
  referenz?: string
  faq: { q: string; a: string }[]
}

export const branchen: Branche[] = [
  {
    slug: 'e-commerce',
    title: 'E-Commerce & Onlinehandel',
    teaser:
      'Bestände, Preise und Bestellungen über alle Kanäle synchron — ohne nächtliche Handarbeit.',
    metaTitle: 'E-Commerce automatisieren — Shop, Marktplätze & ERP verbinden',
    metaDescription:
      'Bestandsabgleich, Preispflege und Bestellverarbeitung für Shopify, PlentyONE, eBay und Amazon automatisieren. Schnittstellen, die laufen statt zu klemmen.',
    keywords: [
      'E-Commerce Automatisierung',
      'Shopify Schnittstelle',
      'PlentyONE Anbindung',
      'eBay API Bestandsabgleich',
      'Amazon Marktplatz Automatisierung',
      'Multichannel Bestandssynchronisation',
    ],
    intro:
      'Im Onlinehandel entsteht der Schaden nicht durch einen großen Fehler, sondern durch viele kleine: ein Bestand, der zehn Minuten zu spät aktualisiert wird, ein Preis, der auf einem Kanal noch der alte ist, eine Bestellung, die niemand ins ERP übertragen hat. Jeder Vorfall ist für sich harmlos. Zusammen kosten sie Marge, Bewertungen und Nerven.',
    painpoints: [
      'Ein Artikel ist auf drei Kanälen gelistet und im Lager einmal vorhanden. Wer zuerst kauft, gewinnt — der Rest wird storniert.',
      'Preisänderungen werden pro Kanal von Hand nachgezogen. Nach der dritten Plattform stimmt irgendwo etwas nicht mehr.',
      'Bestellungen landen als E-Mail im Postfach und werden abgetippt. Bei Retouren beginnt dasselbe Spiel rückwärts.',
      'Der Lieferant schickt eine Bestandsliste als Excel-Anhang. Jemand öffnet sie, filtert, kopiert und lädt hoch.',
      'Niemand merkt, wenn eine Schnittstelle stillsteht — bis der erste Kunde reklamiert.',
    ],
    loesungen: [
      {
        title: 'Bestände in Echtzeit',
        text: 'Ein zentraler Bestand, von dem alle Kanäle lesen. Verkauft ein Kanal, sinkt der Bestand überall — in Sekunden, nicht im Nachtlauf.',
      },
      {
        title: 'Preise nach Regeln',
        text: 'Aufschläge, Kanalpreise und Aktionen als Regelwerk statt als Handarbeit. Änderungen greifen überall gleichzeitig.',
      },
      {
        title: 'Bestellungen ohne Umweg',
        text: 'Vom Marktplatz direkt ins ERP oder Warenwirtschaftssystem, inklusive Retouren und Gutschriften.',
      },
      {
        title: 'Lieferantendaten einlesen',
        text: 'CSV, Excel oder API — Preislisten und Bestände werden geprüft, zugeordnet und übernommen.',
      },
      {
        title: 'Überwachung mit Alarm',
        text: 'Jede Schnittstelle meldet, wenn sie nicht durchläuft. Du erfährst es vor deinen Kunden.',
      },
    ],
    systeme: ['Shopify', 'PlentyONE', 'eBay API', 'Amazon SP-API', 'WooCommerce', 'Make.com', 'n8n'],
    referenz: 'marktplatz-synchronisation',
    faq: [
      {
        q: 'Muss ich mein Shopsystem wechseln?',
        a: 'Nein. Die Automatisierung setzt auf dein bestehendes System auf und spricht mit ihm über die vorhandene Schnittstelle. Ein Systemwechsel ist ein eigenes Projekt und selten die günstigere Lösung.',
      },
      {
        q: 'Wie schnell synchronisieren die Bestände?',
        a: 'Das hängt davon ab, was die jeweilige Plattform zulässt. Shopify und PlentyONE erlauben ereignisbasierte Aktualisierung in Sekunden, Amazon und eBay arbeiten mit eigenen Verarbeitungszeiten. Realistisch sind wenige Sekunden bis wenige Minuten — statt eines Nachtlaufs.',
      },
      {
        q: 'Was passiert, wenn eine Plattform ausfällt?',
        a: 'Fehlgeschlagene Übertragungen werden in eine Warteschlange gelegt und automatisch wiederholt. Bleibt es dabei, bekommst du eine Meldung mit dem konkreten Vorgang, statt es zufällig zu entdecken.',
      },
    ],
  },
  {
    slug: 'spedition-und-logistik',
    title: 'Spedition & Logistik',
    teaser:
      'Aufträge, Statusmeldungen und Papiere fließen zwischen Auftraggeber, Fahrer und TMS — ohne Telefonkette.',
    metaTitle: 'Logistik & Spedition automatisieren — Auftragsdaten, Status, Papiere',
    metaDescription:
      'Transportaufträge automatisch erfassen, Statusmeldungen weitergeben, Frachtpapiere und Rechnungen ohne Abtippen. Automatisierung für Speditionen und Logistiker.',
    keywords: [
      'Logistik Automatisierung',
      'Spedition Software Schnittstelle',
      'Transportauftrag automatisch erfassen',
      'TMS Anbindung',
      'Frachtpapiere automatisieren',
      'Statusmeldung Logistik',
    ],
    intro:
      'In der Spedition steckt die Arbeit selten im Fahren, sondern im Nachfragen. Wo steht die Sendung, ist der Auftrag angekommen, liegt der Lieferschein vor. Diese Fragen kosten jeden Tag Stunden — und die Antwort liegt fast immer schon irgendwo im System, nur nicht dort, wo sie gebraucht wird.',
    painpoints: [
      'Transportaufträge kommen als PDF, Excel oder Fax herein und werden ins TMS abgetippt. Bei jedem Auftraggeber sieht das Formular anders aus.',
      'Der Auftraggeber ruft an, um den Status zu erfragen. Die Disposition ruft den Fahrer an, um ihn zu erfahren.',
      'Ablieferbelege liegen als Foto auf einem Handy. Bis sie in der Akte sind, vergehen Tage — die Rechnung wartet.',
      'Subunternehmer melden Verfügbarkeiten per WhatsApp. Wer wann frei ist, weiß nur die Person, die gerade Dienst hat.',
      'Die Abrechnung zieht Zuschläge, Maut und Wartezeiten aus drei verschiedenen Quellen zusammen. Von Hand.',
    ],
    loesungen: [
      {
        title: 'Aufträge automatisch erfassen',
        text: 'Eingehende PDFs und E-Mails werden per KI ausgelesen, den richtigen Feldern zugeordnet und im TMS angelegt — inklusive Rückfrage, wenn etwas unklar ist.',
      },
      {
        title: 'Status ohne Nachfragen',
        text: 'Sendungsstatus fließen automatisch an den Auftraggeber, per Portal, E-Mail oder Schnittstelle. Das Telefon bleibt still.',
      },
      {
        title: 'Belege sofort im System',
        text: 'Der Fahrer fotografiert den Ablieferbeleg, die Zuordnung zum Auftrag passiert automatisch. Die Rechnung kann sofort raus.',
      },
      {
        title: 'Abrechnung vorbereitet',
        text: 'Zuschläge, Wartezeiten und Maut werden je Auftrag zusammengeführt, sodass die Rechnung nur noch freigegeben wird.',
      },
    ],
    systeme: ['TMS-Systeme', 'EDI / EDIFACT', 'REST APIs', 'Make.com', 'n8n', 'Claude API'],
    referenz: 'voice-to-task',
    faq: [
      {
        q: 'Funktioniert die Auftragserfassung auch bei uneinheitlichen Formularen?',
        a: 'Genau dafür ist sie gemacht. Ein Sprachmodell liest das Dokument inhaltlich statt nach festen Positionen. Neue Auftraggeber brauchen deshalb keine eigene Vorlage. Unsichere Felder werden zur Prüfung vorgelegt, statt geraten zu werden.',
      },
      {
        q: 'Wir haben ein älteres TMS ohne moderne Schnittstelle. Geht das trotzdem?',
        a: 'Meistens ja. Wenn keine API vorhanden ist, kommen Datei-Import, Datenbankzugriff oder EDI in Frage. Was möglich ist, klären wir vor dem Angebot — nicht danach.',
      },
    ],
  },
  {
    slug: 'produktion-und-fertigung',
    title: 'Produktion & Fertigung',
    teaser:
      'Aufträge, Rückmeldungen und Materialbedarf ohne Zettelwirtschaft zwischen Halle und Büro.',
    metaTitle: 'Produktion automatisieren — Aufträge, Rückmeldung, Materialbedarf',
    metaDescription:
      'Fertigungsaufträge, Betriebsdatenerfassung und Materialdisposition automatisieren, ohne das bestehende ERP abzulösen. Automatisierung für Produktion und Fertigung.',
    keywords: [
      'Produktion Automatisierung',
      'Fertigung Digitalisierung',
      'Betriebsdatenerfassung automatisieren',
      'ERP Schnittstelle Produktion',
      'Materialdisposition Software',
    ],
    intro:
      'In der Fertigung liegen die wichtigsten Informationen selten im ERP, sondern daneben: auf Laufkarten, in Excel-Listen und im Kopf des Meisters. Das funktioniert, solange niemand ausfällt und nichts Ungewöhnliches passiert. Automatisierung bedeutet hier nicht, das ERP zu ersetzen, sondern die Lücken daneben zu schließen.',
    painpoints: [
      'Fertigungsaufträge werden ausgedruckt, in der Halle beschriftet und später wieder ins System übertragen.',
      'Ob ein Auftrag im Plan liegt, weiß man erst, wenn jemand herumfragt.',
      'Materialbedarf wird aus einer Excel-Liste abgeleitet, die eine Person pflegt und alle nutzen.',
      'Eine Konstruktionsänderung geht per E-Mail raus. Ob sie alle laufenden Aufträge erreicht hat, prüft niemand.',
      'Nacharbeit taucht in keiner Kalkulation auf. Was ein Teil wirklich gekostet hat, rechnet jemand hinterher von Hand nach.',
    ],
    loesungen: [
      {
        title: 'Rückmeldung ohne Papier',
        text: 'Mengen und Zeiten werden dort erfasst, wo sie entstehen — per Tablet oder Scanner — und landen direkt im ERP.',
      },
      {
        title: 'Plan-Ist auf einen Blick',
        text: 'Ein Überblick, der zeigt, welche Aufträge im Plan liegen und welche nicht. Ohne Rundgang, ohne Nachfragen.',
      },
      {
        title: 'Materialbedarf automatisch',
        text: 'Bedarfe werden aus Aufträgen und Beständen abgeleitet und als Bestellvorschlag vorgelegt, statt in einer Liste gepflegt.',
      },
      {
        title: 'Änderungen nachvollziehbar',
        text: 'Konstruktionsänderungen werden an die betroffenen Aufträge gebunden, sodass sichtbar ist, wo sie schon angekommen sind.',
      },
    ],
    systeme: ['ERP-Systeme', 'MES', 'REST APIs', 'Datenbanken', 'Make.com', 'n8n'],
    faq: [
      {
        q: 'Müssen wir unser ERP ablösen?',
        a: 'Nein, und das ist selten sinnvoll. Die Automatisierung setzt neben dem ERP an und bindet die Stellen an, an denen heute Excel und Zuruf einspringen. Das ERP bleibt das führende System.',
      },
      {
        q: 'Was ist, wenn in der Halle kein WLAN liegt?',
        a: 'Erfassungsgeräte können offline arbeiten und synchronisieren, sobald wieder Verbindung besteht. Das ist Standard, kein Sonderfall.',
      },
    ],
  },
  {
    slug: 'grosshandel-und-distribution',
    title: 'Großhandel & Distribution',
    teaser:
      'Artikeldaten, Preislisten und Kundenbestellungen laufen durch, statt in Postfächern zu warten.',
    metaTitle: 'Großhandel automatisieren — Artikeldaten, Preislisten, Bestellungen',
    metaDescription:
      'Lieferantendaten einlesen, Preislisten pflegen, Kundenbestellungen automatisch verarbeiten. Automatisierung für Großhandel und Distribution.',
    keywords: [
      'Großhandel Automatisierung',
      'Artikeldaten Import automatisieren',
      'Preisliste automatisch aktualisieren',
      'B2B Bestellprozess automatisieren',
      'Lieferantenschnittstelle',
    ],
    intro:
      'Im Großhandel ist die Ware selten das Problem, die Daten sind es. Jeder Lieferant liefert seine Artikel anders, jeder Kunde bestellt anders, und dazwischen sitzen Menschen, die übersetzen. Genau diese Übersetzungsarbeit lässt sich zu großen Teilen automatisieren.',
    painpoints: [
      'Jeder Lieferant schickt seinen Katalog in einem eigenen Format. Die Zuordnung zu den eigenen Artikelnummern macht jemand per Hand.',
      'Preisänderungen kommen als PDF. Bis sie im System sind, wird zu alten Preisen verkauft.',
      'Stammkunden bestellen per E-Mail mit eigener Artikelbezeichnung. Das übersetzt der Innendienst.',
      'Verfügbarkeitsanfragen binden Zeit, obwohl die Antwort im System steht.',
      'Staffelpreise und Kundenkonditionen liegen in mehreren Listen, die auseinanderlaufen.',
    ],
    loesungen: [
      {
        title: 'Lieferantendaten vereinheitlichen',
        text: 'Kataloge und Preislisten werden eingelesen, den eigenen Artikeln zugeordnet und geprüft übernommen — auch aus PDF.',
      },
      {
        title: 'Bestellungen automatisch lesen',
        text: 'E-Mail-Bestellungen werden per KI in Positionen übersetzt, inklusive kundeneigener Bezeichnungen, und als Auftrag vorgelegt.',
      },
      {
        title: 'Auskunft ohne Rückfrage',
        text: 'Verfügbarkeit und Preis beantwortet ein Kundenportal oder ein Chatbot direkt aus dem System.',
      },
      {
        title: 'Konditionen an einer Stelle',
        text: 'Staffeln und Kundenpreise werden zentral geführt und überall gleich angewendet.',
      },
    ],
    systeme: ['ERP-Systeme', 'PlentyONE', 'CSV / EDI', 'REST APIs', 'Claude API', 'n8n'],
    referenz: 'ki-kundenservice',
    faq: [
      {
        q: 'Wie zuverlässig liest die KI eine Bestellung aus?',
        a: 'Gut genug, um die Arbeit zu übernehmen, aber nicht gut genug, um unbeaufsichtigt zu buchen. Deshalb wird jede erkannte Position mit Konfidenz vorgelegt: eindeutige Zeilen laufen durch, unsichere gehen zur Prüfung. Das ist schneller als Abtippen und sicherer als blindes Vertrauen.',
      },
    ],
  },
  {
    slug: 'handwerk-und-bau',
    title: 'Handwerk & Bau',
    teaser:
      'Anfragen, Aufmaße und Rechnungen laufen mit, statt abends im Büro nachgearbeitet zu werden.',
    metaTitle: 'Handwerk automatisieren — Anfragen, Angebote, Dokumentation',
    metaDescription:
      'Anfragen automatisch erfassen, Angebote schneller erstellen, Baustellendokumentation ohne Abendschicht. Automatisierung für Handwerk und Baugewerbe.',
    keywords: [
      'Handwerk Digitalisierung',
      'Angebot automatisch erstellen Handwerk',
      'Baustellendokumentation App',
      'Handwerkersoftware Schnittstelle',
      'Anfragen automatisch erfassen',
    ],
    intro:
      'Im Handwerk passiert die Wertschöpfung auf der Baustelle, die Verwaltung abends am Küchentisch. Angebote, Aufmaße, Stundenzettel und Rechnungen kosten Zeit, die niemand hat. Automatisierung heißt hier vor allem: das Büro schrumpfen, ohne etwas zu verlieren.',
    painpoints: [
      'Anfragen kommen über Telefon, Formular und WhatsApp. Manche gehen unter, und niemand merkt es.',
      'Für ein Angebot werden Positionen aus alten Angeboten zusammenkopiert.',
      'Stunden werden auf Zetteln notiert und am Monatsende eingetippt.',
      'Fotos von der Baustelle liegen auf verschiedenen Handys, ohne Bezug zum Auftrag.',
      'Rechnungen gehen spät raus, weil erst jemand alles zusammensuchen muss.',
    ],
    loesungen: [
      {
        title: 'Alle Anfragen an einer Stelle',
        text: 'Telefon, Formular und Messenger laufen in einer Liste zusammen. Jede Anfrage bekommt einen Status, keine geht unter.',
      },
      {
        title: 'Angebote schneller',
        text: 'Wiederkehrende Positionen als Bausteine, Angebot aus der Anfrage vorbefüllt statt aus alten Dateien kopiert.',
      },
      {
        title: 'Dokumentation unterwegs',
        text: 'Fotos, Stunden und Notizen werden direkt dem Auftrag zugeordnet — vom Handy aus, ohne Nacharbeit.',
      },
      {
        title: 'Rechnung auf Knopfdruck',
        text: 'Was dokumentiert ist, steht in der Rechnung. Freigeben statt zusammensuchen.',
      },
    ],
    systeme: ['Handwerkersoftware', 'Make.com', 'n8n', 'WhatsApp Business API', 'REST APIs'],
    faq: [
      {
        q: 'Lohnt sich das für einen Betrieb mit fünf Leuten?',
        a: 'Oft gerade dann. Je kleiner der Betrieb, desto stärker fällt Verwaltungszeit ins Gewicht, weil sie von Leuten erledigt wird, die sonst produktiv wären. Wo sich der Aufwand nicht rechnet, sage ich das im Erstgespräch.',
      },
    ],
  },
  {
    slug: 'dienstleistung-und-agenturen',
    title: 'Dienstleistung & Agenturen',
    teaser:
      'Leads, Angebote und Projektabläufe automatisiert — damit abrechenbare Zeit abrechenbar bleibt.',
    metaTitle: 'Agentur & Dienstleister automatisieren — Leads, Angebote, Projekte',
    metaDescription:
      'Leadqualifizierung, Angebotserstellung und wiederkehrende Projektabläufe automatisieren. Automatisierung für Agenturen, Berater und Dienstleister.',
    keywords: [
      'Agentur Automatisierung',
      'Lead Qualifizierung automatisieren',
      'Angebotsprozess automatisieren',
      'Projektmanagement Automatisierung',
      'CRM Workflow',
    ],
    intro:
      'Wer Zeit verkauft, verliert an jeder unbezahlten Stunde doppelt. Bei Dienstleistern steckt der größte Hebel deshalb selten in der Leistung selbst, sondern in allem, was sie umgibt: Anfragen sortieren, Angebote schreiben, Projekte aufsetzen, nachfassen.',
    painpoints: [
      'Anfragen werden von Hand gesichtet, obwohl die Hälfte offensichtlich nicht passt.',
      'Jedes Angebot entsteht neu, obwohl sich achtzig Prozent wiederholen.',
      'Ein neues Projekt bedeutet: Ordner anlegen, Board aufsetzen, Zugänge verteilen — jedes Mal von Hand.',
      'Nachfassen passiert, wenn jemand daran denkt.',
      'Am Monatsende weiß niemand genau, welche Stunden abrechenbar waren.',
    ],
    loesungen: [
      {
        title: 'Anfragen vorqualifiziert',
        text: 'Ein Chatbot oder Formular stellt die Rückfragen, die sonst der erste Anruf klärt, und sortiert vor.',
      },
      {
        title: 'Angebote aus Bausteinen',
        text: 'Wiederkehrende Leistungen als Module, Angebot aus dem Gespräch vorbefüllt statt aus dem letzten Dokument kopiert.',
      },
      {
        title: 'Projektstart automatisch',
        text: 'Ordner, Board, Zugänge und Kickoff-Termin entstehen aus dem gewonnenen Angebot heraus.',
      },
      {
        title: 'Nachfassen ohne Erinnerung',
        text: 'Offene Angebote melden sich selbst, nach deinem Rhythmus statt nach Zufall.',
      },
    ],
    systeme: ['CRM-Systeme', 'Notion', 'Slack', 'Make.com', 'n8n', 'Claude API'],
    referenz: 'voice-to-task',
    faq: [
      {
        q: 'Wir arbeiten mit vielen verschiedenen Tools. Ist das ein Problem?',
        a: 'Im Gegenteil, das ist der Normalfall und genau der Grund für Automatisierung. Entscheidend ist nicht, wie viele Tools im Einsatz sind, sondern ob sie eine Schnittstelle haben. Die allermeisten haben eine.',
      },
    ],
  },
]

export function getBranche(slug: string) {
  return branchen.find((b) => b.slug === slug)
}

/**
 * Industry ("Branchen") landing pages. Each entry produces a premium,
 * funnel-style landing at /branche/<slug> built around Lina, the AI phone
 * agent — the angle that converts best per niche.
 *
 * Photos point to local files under /public/hero/. Until a file exists, the
 * landing shows a descriptive placeholder telling the owner which photo to add
 * and where. Drop e.g. public/hero/coaching.jpg to replace the placeholder.
 */

export interface Industry {
  slug: string;
  label: string; // short chip label, e.g. "Coaching"
  eyebrow: string; // small line above the headline
  title: string; // headline lead, e.g. "für"
  highlight: string; // the part rendered in the accent color
  sub: string;
  bullets: string[];
  photo: string;
  photoNeed: string;
  metaTitle: string;
  metaDesc: string;
}

export const INDUSTRIES: Industry[] = [
  {
    slug: 'coaching',
    label: 'Coaching',
    eyebrow: 'KI-Telefonassistent',
    title: 'für',
    highlight: 'Coaches & Berater',
    sub: 'In den Coaching-Funnel tragen sich viele unverbindlich ein – aber längst nicht jeder erscheint zum Strategiegespräch. Lina ruft jede Bewerbung in Sekunden zurück, qualifiziert vor, erinnert an den Termin und bucht direkt in deinen Kalender – für deutlich mehr gehaltene Gespräche.',
    bullets: ['Speed-to-Lead in unter 60 Sekunden', 'Mehr gehaltene Strategiegespräche', 'Nur qualifizierte Bewerber im Call', 'DSGVO-konform, auf Deutsch'],
    photo: '/hero/coaching.jpg',
    photoNeed: 'Sympathischer Coach/Berater (30–45 J.) am Schreibtisch oder im Video-Call, freundlich lächelnd, modernes Büro. Hochwertig, hell, professionell.',
    metaTitle: 'KI-Telefonassistent für Coaches | Youman Automation',
    metaDesc: 'Lina ruft deine Funnel-Leads sofort zurück, qualifiziert vor und bucht Strategiegespräche direkt in deinen Kalender. DSGVO-konform, auf Deutsch.',
  },
  {
    slug: 'handwerk',
    label: 'Handwerk',
    eyebrow: 'KI-Telefonassistent',
    title: 'für',
    highlight: 'Handwerksbetriebe',
    sub: 'Während du auf der Baustelle bist, klingelt das Telefon – und der Auftrag geht zur Konkurrenz. Lina nimmt jede Anfrage entgegen, ruft Interessenten zurück, klärt die wichtigsten Eckdaten und vereinbart den Besichtigungstermin automatisch.',
    bullets: ['Keine verpasste Anfrage mehr', 'Rückruf in Sekunden statt Tagen', 'Termine direkt im Kalender', 'Mehr Aufträge ohne Mehraufwand'],
    photo: '/hero/handwerk.jpg',
    photoNeed: 'Handwerker/Meister (Elektriker, Maler, SHK) in Arbeitskleidung, mit Tablet oder Smartphone, vor Baustelle/Werkstatt. Bodenständig, vertrauenswürdig, hell.',
    metaTitle: 'KI-Telefonassistent für Handwerksbetriebe | Youman Automation',
    metaDesc: 'Lina nimmt jede Anfrage an, ruft zurück und vereinbart Besichtigungstermine automatisch – damit kein Auftrag mehr verloren geht.',
  },
  {
    slug: 'agenturen',
    label: 'Agenturen',
    eyebrow: 'KI-Telefonassistent',
    title: 'für',
    highlight: 'Agenturen',
    sub: 'Eingehende Leads kühlen ab, wenn niemand sofort reagiert. Lina ruft neue Anfragen umgehend an, qualifiziert nach deinen Kriterien und bucht das Erstgespräch nur mit den Leads, die wirklich passen.',
    bullets: ['Inbound-Leads sofort kontaktiert', 'Qualifizierung nach deinen Kriterien', 'Erstgespräche automatisch gebucht', 'Dein Team spricht nur mit A-Leads'],
    photo: '/hero/agenturen.jpg',
    photoNeed: 'Modernes Agentur-Team (2–3 Personen) am Laptop in hellem Loft-Büro, kreative Atmosphäre, lächelnd im Gespräch. Dynamisch, jung, professionell.',
    metaTitle: 'KI-Telefonassistent für Agenturen | Youman Automation',
    metaDesc: 'Lina kontaktiert Inbound-Leads sofort, qualifiziert sie und bucht Erstgespräche – damit dein Team nur mit den richtigen Leads spricht.',
  },
  {
    slug: 'immobilien',
    label: 'Immobilien',
    eyebrow: 'KI-Telefonassistent',
    title: 'für',
    highlight: 'Makler & Immobilien',
    sub: 'Auf ein Exposé melden sich Dutzende Interessenten gleichzeitig. Lina ruft jeden zurück, prüft Ernsthaftigkeit und Budget und vereinbart Besichtigungen – ohne dass du im Telefon-Marathon versinkst.',
    bullets: ['Jeder Interessent wird zurückgerufen', 'Vorqualifizierung von Budget & Ernsthaftigkeit', 'Besichtigungstermine automatisch', 'Mehr Abschlüsse, weniger Aufwand'],
    photo: '/hero/immobilien.jpg',
    photoNeed: 'Immobilienmakler/in im Anzug/Blazer vor moderner Immobilie oder mit Tablet, selbstbewusst lächelnd. Edel, seriös, hell.',
    metaTitle: 'KI-Telefonassistent für Makler | Youman Automation',
    metaDesc: 'Lina ruft jeden Interessenten zurück, qualifiziert vor und vereinbart Besichtigungen automatisch – Schluss mit dem Telefon-Marathon.',
  },
  {
    slug: 'fitness',
    label: 'Fitness',
    eyebrow: 'KI-Telefonassistent',
    title: 'für',
    highlight: 'Fitness & Studios',
    sub: 'Probetraining-Anfragen sind heiß – aber nur für ein paar Minuten. Lina ruft Interessenten sofort an, bucht das Probetraining und erinnert daran, damit aus Anfragen echte Mitglieder werden.',
    bullets: ['Probetraining sofort gebucht', 'Automatische Terminerinnerung', 'Weniger No-Shows', 'Mehr Mitglieder aus denselben Anfragen'],
    photo: '/hero/fitness.jpg',
    photoNeed: 'Fitnessstudio-Inhaber/Trainer in modernem Studio, sportlich, freundlich, mit Tablet oder am Empfang. Energiegeladen, hell, hochwertig.',
    metaTitle: 'KI-Telefonassistent für Fitnessstudios | Youman Automation',
    metaDesc: 'Lina ruft Probetraining-Anfragen sofort an, bucht Termine und reduziert No-Shows – damit mehr Anfragen zu Mitgliedern werden.',
  },
  {
    slug: 'kanzleien',
    label: 'Kanzleien',
    eyebrow: 'KI-Telefonassistent',
    title: 'für',
    highlight: 'Kanzleien & Berater',
    sub: 'Mandatsanfragen kommen rund um die Uhr – aber Erstberatungen kosten Zeit. Lina nimmt Anfragen entgegen, klärt das Anliegen vor und bucht die Erstberatung nur für passende Mandate in deinen Kalender.',
    bullets: ['Anfragen rund um die Uhr angenommen', 'Anliegen vorab geklärt', 'Erstberatung automatisch gebucht', 'DSGVO-konform, Server in Deutschland'],
    photo: '/hero/kanzleien.jpg',
    photoNeed: 'Anwalt/Steuerberater/in im Business-Outfit in seriösem Büro mit Bücherregal, vertrauenswürdig lächelnd. Seriös, edel, gedeckte Farben.',
    metaTitle: 'KI-Telefonassistent für Kanzleien | Youman Automation',
    metaDesc: 'Lina nimmt Mandatsanfragen an, klärt das Anliegen vor und bucht Erstberatungen automatisch – DSGVO-konform und auf Deutsch.',
  },
];

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

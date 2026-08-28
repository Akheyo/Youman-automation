import type { BildKey } from './bilder'

export const site = {
  name: 'Youman',
  fullName: 'Youman — AI & Software',
  legalName: 'Youman Automation',
  url: 'https://www.youman-automation.de',
  tagline: 'AI & Software',
  description:
    'Youman entwickelt KI-Automationen, LLM-Chatbots, moderne Websites und E-Commerce-Integrationen. Make.com, n8n, Claude API, Next.js, Shopify und PlentyONE — direkt umgesetzt, ohne Agentur-Overhead.',
  email: 'info@youman-automation.de',
  phone: '+49 155 67541365',
  phoneHref: '+4915567541365',
  whatsapp: 'https://wa.me/4915567541365',
  location: 'Deutschland — remote weltweit',
  areaServed: ['Deutschland', 'Österreich', 'Schweiz'],
  responseTime: '24 Stunden',
  locale: 'de_DE',
} as const

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/branchen', label: 'Branchen' },
  { href: '/leistungen', label: 'Leistungen' },
  { href: '/referenzprojekte', label: 'Referenzprojekte' },
  { href: '/ueber-uns', label: 'Über uns' },
  { href: '/kontakt', label: 'Kontakt' },
] as const

export type IconName =
  | 'workflow'
  | 'chat'
  | 'globe'
  | 'cart'
  | 'bolt'
  | 'check'
  | 'clock'
  | 'shield'
  | 'spark'
  | 'user'
  | 'mail'
  | 'phone'
  | 'pin'
  | 'arrow'
  | 'minus'

export type Service = {
  slug: string
  index: string
  icon: IconName
  title: string
  teaser: string
  body: string
  outcomes: string[]
  stack: string[]
  bild: BildKey
}

export const services: Service[] = [
  {
    slug: 'ki-automationen',
    bild: 'leistungAutomation',
    index: '01',
    icon: 'workflow',
    title: 'KI-Automationen',
    teaser:
      'Make.com, n8n und Custom Code verschmelzen zu Workflows, die rund um die Uhr für Sie arbeiten.',
    body: 'Leads, Bestellungen, E-Mails, Datenabgleich — Prozesse, die heute Stunden manueller Arbeit kosten, laufen als überwachter Workflow. Mit Fehlerbehandlung, Retry-Logik und Benachrichtigung, wenn doch mal etwas hakt.',
    outcomes: [
      'Wiederkehrende Abläufe laufen ohne manuelles Zutun',
      'Daten fließen zwischen Tools, die sonst nicht miteinander reden',
      'Fehlerquote sinkt, weil kein Copy-and-Paste mehr nötig ist',
    ],
    stack: ['Make.com', 'n8n', 'Zapier', 'REST APIs', 'Webhooks'],
  },
  {
    slug: 'ki-chatbots',
    bild: 'leistungChatbot',
    index: '02',
    icon: 'chat',
    title: 'KI-Chatbots',
    teaser:
      'Echte LLMs statt Skript-Theater — für Kundenservice, Lead-Qualifizierung und internes Wissen.',
    body: 'Chatbots auf Basis von Claude, GPT oder Groq, angebunden an Ihre echten Inhalte per RAG. Sie beantworten Fragen aus Ihrer Wissensdatenbank, qualifizieren Anfragen vor und übergeben sauber an einen Menschen, wenn es nötig wird.',
    outcomes: [
      'Ein Großteil der Standardanfragen wird eigenständig beantwortet',
      'Antworten kommen aus Ihren Dokumenten, nicht aus dem Nichts',
      'Automatische Eskalation an Ihr Team statt Sackgasse',
    ],
    stack: ['Claude API', 'OpenAI', 'Groq', 'RAG', 'WhatsApp'],
  },
  {
    slug: 'websites',
    bild: 'leistungWebsite',
    index: '03',
    icon: 'globe',
    title: 'Moderne Websites',
    teaser:
      'Pixel-genau, blitzschnell, auf Conversion gebaut — nicht nur schön, sondern verkaufend.',
    body: 'Next.js oder schlankes HTML/CSS, je nachdem was Ihr Projekt wirklich braucht. Sauberes SEO-Fundament, gute Core Web Vitals, barrierefreie Bedienung und ein Design, das zu Ihrer Marke passt statt zum Template.',
    outcomes: [
      'Schnelle Ladezeiten auf Mobilgeräten, nicht nur im Test',
      'Klare Nutzerführung bis zur Anfrage',
      'Technisches SEO und Metadaten von Anfang an korrekt',
    ],
    stack: ['Next.js', 'React', 'HTML/CSS', 'SEO', 'Responsive'],
  },
  {
    slug: 'e-commerce',
    bild: 'leistungEcommerce',
    index: '04',
    icon: 'cart',
    title: 'E-Commerce-Lösungen',
    teaser:
      'Shopify, PlentyONE, eBay- und Amazon-API — Bestände, Preise und Bestellungen laufen allein.',
    body: 'Marktplatz-Anbindungen, die Bestände in Echtzeit synchron halten, Preise nach Ihren Regeln anpassen und Bestellungen automatisch ins ERP schreiben. Inklusive Monitoring, damit Sie sehen, dass es läuft.',
    outcomes: [
      'Bestände über alle Kanäle hinweg konsistent',
      'Preisanpassungen nach Regeln statt per Hand',
      'Bestellungen landen ohne Umweg im System',
    ],
    stack: ['Shopify', 'PlentyONE', 'eBay API', 'Amazon API'],
  },
]

export const processSteps = [
  {
    step: '01',
    title: 'Erstgespräch',
    text: 'Kostenlos und unverbindlich. Ich schaue mir Ihren Prozess an und sage Ihnen ehrlich, was sich lohnt zu automatisieren — und was nicht.',
  },
  {
    step: '02',
    title: 'Klares Angebot',
    text: 'Fester Scope, fester Zeitplan, fester Preis. Kein Kleingedrucktes, keine Überraschung auf der Rechnung.',
  },
  {
    step: '03',
    title: 'Umsetzung',
    text: 'Regelmäßige Updates, direkte Kommunikation. Sie sehen Zwischenstände, statt wochenlang im Dunkeln zu sitzen.',
  },
  {
    step: '04',
    title: 'Launch & Support',
    text: 'Go-Live, Übergabe und Dokumentation. Danach bin ich genauso erreichbar wie vorher.',
  },
] as const

export const projects = [
  {
    title: 'Voice-to-Task Automation',
    kicker: 'Make.com · Claude API',
    text: 'Sprachnotizen werden per Webhook erfasst, per KI transkribiert und priorisiert und automatisch als strukturierte Aufgabe im Projektmanagement angelegt.',
    stack: ['Make.com', 'Claude API', 'Webhooks'],
  },
  {
    title: 'Marktplatz-Automation',
    kicker: 'n8n · PlentyONE · eBay',
    text: 'Vollautomatische Bestandssynchronisation und regelbasierte Preisanpassung über eBay, Amazon und Shopify in Echtzeit — inklusive Fehler-Monitoring.',
    stack: ['n8n', 'PlentyONE', 'eBay API'],
  },
  {
    title: 'KI-Kundenservice-Bot',
    kicker: 'Claude API · Groq · RAG',
    text: 'Chatbot mit RAG-Wissensdatenbank, automatischer Eskalation an Mitarbeitende und Analytics-Dashboard für laufende Qualitätssicherung.',
    stack: ['Claude API', 'Groq', 'RAG'],
  },
  {
    title: 'Business-Website',
    kicker: 'Next.js · React',
    text: 'Unternehmenswebsite mit dezenter Animationsebene, CMS-Anbindung, starken Core Web Vitals und messbar höherer Anfragequote nach Launch.',
    stack: ['Next.js', 'React', 'CMS'],
  },
] as const

export const testimonials = [
  {
    quote:
      'Die Automation hat unsere Auftragsverarbeitung komplett verändert. Was früher drei Stunden gedauert hat, läuft jetzt vollautomatisch — ohne einen einzigen Fehler.',
    name: 'Lisa M.',
    role: 'Inhaberin, E-Commerce',
  },
  {
    quote:
      'Der KI-Chatbot beantwortet inzwischen einen Großteil der Kundenanfragen eigenständig — und besser, als ich erwartet hatte. Enorme Zeitersparnis für das Team.',
    name: 'Thomas K.',
    role: 'Geschäftsführer',
  },
  {
    quote:
      'Schnelle Kommunikation, sauberer Code, ein Design das überzeugt — und auch nach dem Launch noch ansprechbar. Klare Empfehlung.',
    name: 'Sarah P.',
    role: 'Gründerin, Startup',
  },
] as const

export const comparison = {
  columns: ['Youman', 'Agentur', 'Festanstellung'],
  rows: [
    {
      label: 'Kommunikation',
      values: [
        { tone: 'good', text: 'Immer direkt mit mir' },
        { tone: 'bad', text: 'Über Account-Manager' },
        { tone: 'good', text: 'Direkt im Team' },
      ],
    },
    {
      label: 'Startzeit',
      values: [
        { tone: 'good', text: 'Sofort bis 24 Stunden' },
        { tone: 'mid', text: '2–4 Wochen' },
        { tone: 'bad', text: 'Wochen bis Monate' },
      ],
    },
    {
      label: 'Kosten',
      values: [
        { tone: 'good', text: 'Fair und transparent' },
        { tone: 'bad', text: 'Hohe Overheads' },
        { tone: 'bad', text: 'Fixkosten plus Benefits' },
      ],
    },
    {
      label: 'KI-Expertise',
      values: [
        { tone: 'good', text: 'Spezialisiert' },
        { tone: 'mid', text: 'Unterschiedlich' },
        { tone: 'mid', text: 'Selten in der Tiefe' },
      ],
    },
    {
      label: 'Flexibilität',
      values: [
        { tone: 'good', text: 'Skalierbar on demand' },
        { tone: 'mid', text: 'Eingeschränkt' },
        { tone: 'bad', text: 'Festes Stellenprofil' },
      ],
    },
    {
      label: 'Nach dem Launch',
      values: [
        { tone: 'good', text: 'Weiterhin erreichbar' },
        { tone: 'bad', text: 'Kostenpflichtig extra' },
        { tone: 'good', text: 'Dauerhaft im Haus' },
      ],
    },
  ],
} as const

export const faq = [
  {
    q: 'Was kostet ein Projekt?',
    a: 'Jedes Projekt ist individuell, es gibt keinen Einheitspreis. Eine einfache Automation startet bei rund 300–500 €, komplexere Systeme wie KI-Chatbots mit RAG oder vollständige E-Commerce-Integrationen liegen darüber. Im kostenlosen Erstgespräch bekommen Sie einen konkreten Preis ohne Überraschungen.',
  },
  {
    q: 'Wie lange dauert ein typisches Projekt?',
    a: 'Eine einfache Automation ist oft in ein bis drei Tagen fertig. Eine komplette Website oder ein KI-Chatbot dauert in der Regel ein bis drei Wochen, je nach Komplexität. Den Zeitplan bekommen Sie immer vorab.',
  },
  {
    q: 'Müssen wir technisches Wissen mitbringen?',
    a: 'Nein. Sie beschreiben Ihr Problem und das gewünschte Ergebnis in normaler Sprache, ich kümmere mich um die Technik. Am Ende bekommen Sie eine Lösung, die einfach funktioniert — plus eine verständliche Übergabe.',
  },
  {
    q: 'Welche Tools und Plattformen nutzen Sie?',
    a: 'Make.com, n8n und Zapier für Automationen; Claude API, OpenAI und Groq für KI-Chatbots; Next.js, React und HTML/CSS für Websites; Shopify, PlentyONE, eBay- und Amazon-API für E-Commerce. Die Auswahl richtet sich nach Ihrem Problem, nicht nach meiner Gewohnheit.',
  },
  {
    q: 'Gibt es Support nach dem Projekt?',
    a: 'Ja. Ich bin auch nach dem Launch ansprechbar — für Fragen, kleine Anpassungen oder Erweiterungen. Kein Ticket-System, sondern direkter Kontakt per E-Mail oder WhatsApp.',
  },
  {
    q: 'Arbeiten Sie auch mit kleinen Unternehmen?',
    a: 'Sehr gerne sogar. Kleine und mittlere Unternehmen profitieren am stärksten von Automatisierung, weil dort jede eingesparte Stunde unmittelbar spürbar ist. Es gibt kein Mindestbudget und keine Mindest-Teamgröße.',
  },
] as const

export const tools = [
  'Make.com',
  'n8n',
  'Claude API',
  'OpenAI',
  'Groq',
  'Next.js',
  'React',
  'Shopify',
  'PlentyONE',
  'eBay API',
  'Amazon API',
  'Webhooks',
  'REST APIs',
  'Zapier',
] as const

/**
 * DATENBASIS — recherchiert am 18.09.2026.
 * Jede Zahl traegt eine Quellen-ID (src). Die IDs loesen sich auf der Quellen-Slide auf.
 * Es werden ausschliesslich Zahlen verwendet, die die genannte Organisation selbst
 * veroeffentlicht hat (Primaerquelle) oder die uebereinstimmend aus deren
 * Veroeffentlichung berichtet wurden (dann als "berichtet" gekennzeichnet).
 */
const ABRUF = '18.09.2026';

const SOURCES = [
  { id: 'bitkom-ki',   org: 'Bitkom e. V.',            title: 'Erstmals nutzt die Mehrheit der Unternehmen KI (Presseinformation, 14.09.2026) sowie Studienbericht „Künstliche Intelligenz in Deutschland" 2026; Basis: 603 Unternehmen ab 20 Beschäftigten', url: 'https://www.bitkom.org/Presse/Presseinformation/Erstmals-nutzt-Mehrheit-Unternehmen-KI' },
  { id: 'bitkom-handel',org: 'Bitkom e. V.',           title: 'Digitaler Handel in Deutschland, Studienbericht 2026; Basis: 1.120 Personen ab 16 Jahren, davon 1.072 Onlineshopper', url: 'https://www.bitkom.org/sites/main/files/2026-07/bitkom-studienbericht-digitaler-handel-in-deutschland.pdf' },
  { id: 'gartner-ai',  org: 'Gartner, Inc.',           title: 'Gartner Forecasts Worldwide AI Spending to Grow 47 % in 2026 (Pressemitteilung, 19.05.2026); Vorjahreswert aus: Worldwide AI Spending Will Total $1.5 Trillion in 2025 (17.09.2025)', url: 'https://www.gartner.com/en/newsroom/press-releases/2026-05-19-gartner-forecasts-worldwide-ai-spending-to-grow-47-percent-in-2026' },
  { id: 'hde',         org: 'HDE — Handelsverband Deutschland', title: 'Online-Monitor 2026; Meldung „Online-Handel als Wachstumstreiber für den Einzelhandel" vom 03.06.2026', url: 'https://einzelhandel.de/online-monitor' },
  { id: 'bevh',        org: 'bevh — Bundesverband E-Commerce und Versandhandel', title: 'Jahreszahlen 2025: „Wachstum im E-Commerce — Lichtblick in der deutschen Wirtschaft"', url: 'https://bevh.org/detail/wachstum-im-e-commerce-lichtblick-in-der-deutschen-wirtschaft' },
  { id: 'mck-genai',   org: 'McKinsey & Company',      title: 'The economic potential of generative AI: The next productivity frontier', url: 'https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier' },
  { id: 'mck-state',   org: 'McKinsey & Company',      title: 'The state of AI: Agents, innovation, and transformation (2025)', url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai' },
  { id: 'mck-agentic', org: 'McKinsey & Company',      title: 'Prognose zu Agentic Commerce bis 2030 (3–5 Bio. US-$ weltweit); berichtet von Digital Commerce 360, 20.10.2025', url: 'https://www.digitalcommerce360.com/2025/10/20/mckinsey-forecast-5-trillion-agentic-commerce-sales-2030/' },
  { id: 'iab',         org: 'IAB — Institut für Arbeitsmarkt- und Berufsforschung', title: 'Forschungsbericht 23/2025 zu KI-Verbreitung, Beschäftigung und Wertschöpfung; Presseinfo „Jeder vierte Betrieb in Deutschland nutzt generative KI"', url: 'https://doku.iab.de/forschungsbericht/2025/fb2325.pdf' },
  { id: 'amazon',      org: 'Amazon.com, Inc.',        title: 'Q4/Geschäftsjahr 2025 Ergebnisse und Earnings Call, Februar 2026 (Angaben zu Rufus durch CEO Andy Jassy); übereinstimmend berichtet von PPC Land und Digital Commerce 360', url: 'https://ir.aboutamazon.com/quarterly-results/' },
  { id: 'zalando',     org: 'Zalando SE (Investor Relations)', title: 'Zalando delivers strong 2025 results… (12.03.2026) und Annual Report 2025', url: 'https://corporate.zalando.com/en/investor-relations/zalando-full-year-2025-results' },
  { id: 'shopify',     org: 'Shopify Inc.',            title: 'Shopify Editions Winter ’26 („The RenAIssance Edition") und Enterprise-AI-Seite mit der Kennzahl „15x AI-attributed orders"', url: 'https://www.shopify.com/editions/winter2026' },
  { id: 'klarna',      org: 'Klarna Bank AB',          title: 'Klarna AI assistant handles two-thirds of customer service chats in its first month (Pressemitteilung); Kurskorrektur 2025 durch CEO Sebastian Siemiatkowski öffentlich eingeräumt', url: 'https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/' },
  { id: 'juniper',     org: 'Juniper Research',        title: 'Fraud Detection & Prevention Spending Reaches $21 Billion Annually (Ausblick bis 2030)', url: 'https://www.juniperresearch.com/press/fraud-detection-and-prevention-spending-reaches-21bn/' },
  { id: 'aiact',       org: 'Europäische Union',       title: 'Verordnung (EU) 2024/1689 (KI-VO / AI Act), Art. 50 und Art. 113; Fristenverschiebung für Anhang-III-Hochrisiko-KI durch den „Digital Omnibus on AI" (politische Einigung 07.05.2026)', url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj' },
  { id: 'statista',    org: 'Statista / ECDB',         title: 'Global retail e-commerce sales 2022–2030 bzw. „Global E-Commerce to Surpass US$7 Trillion by 2030"', url: 'https://www.statista.com/statistics/379046/worldwide-retail-e-commerce-sales/' },
];

/** Kurzform fuer die Fussnote auf der Slide. */
const FN = {
  bitkomKi:   'Bitkom, KI in Deutschland 2026 (n = 603 Unternehmen ab 20 Beschäftigten), Stand 09/2026',
  bitkomHdl:  'Bitkom, Digitaler Handel in Deutschland 2026 (n = 1.072 Onlineshopper)',
  gartner:    'Gartner, Prognose weltweiter KI-Ausgaben, 05/2026 und 09/2025',
  hde:        'HDE Online-Monitor 2026 (Nettoumsatz Onlinehandel Deutschland)',
  bevh:       'bevh, Jahreszahlen 2025',
  mckGenai:   'McKinsey, The economic potential of generative AI (63 analysierte Anwendungsfälle)',
  mckState:   'McKinsey, The state of AI 2025',
  mckAgentic: 'McKinsey, Prognose Agentic Commerce 2030',
  iab:        'IAB-Forschungsbericht 23/2025 (Simulation über 15 Jahre)',
  amazon:     'Amazon, Q4/GJ-2025-Ergebnisse und Earnings Call, 02/2026',
  zalando:    'Zalando SE, Geschäftsjahr 2025 (Veröffentlichung 12.03.2026)',
  shopify:    'Shopify, Editions Winter ’26 und Enterprise-AI-Seite',
  klarna:     'Klarna, Pressemitteilung zum KI-Assistenten; Kurskorrektur 2025',
  juniper:    'Juniper Research, Fraud Detection & Prevention Spending',
  aiact:      'Verordnung (EU) 2024/1689 (KI-VO), Art. 50 und 113; Digital Omnibus on AI',
  statista:   'Statista / ECDB, globaler E-Commerce bis 2030',
};

module.exports = { SOURCES, FN, ABRUF };

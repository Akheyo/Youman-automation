export const site = {
  name: 'adept&',
  /** Wird im Hero unter dem Namen angezeigt */
  region: 'Deutschland',
  claim: 'Beratung. Software. Integration.',
  subclaim: 'Maßgeschneiderte ERP- & SAP-Lösungen für den Mittelstand.',
  description:
    'Managementberatung und individuelle Softwareentwicklung aus einer Hand: adept& analysiert Ihr operatives Problem und baut die Lösung ins bestehende ERP-System.',
} as const;

/** Die vier Kernleistungen aus dem Unternehmensprofil. */
export const kernleistungen = [
  {
    title: 'Prozessberatung',
    description:
      'Analyse und Strukturierung operativer Herausforderungen – von der Produktionsplanung bis zur Logistik.',
  },
  {
    title: 'Custom Software Development',
    description: 'Entwicklung einer maßgeschneiderten Lösung, eingebettet in adept&.',
  },
  {
    title: 'ERP- & SAP-Integration',
    description:
      'Nahtlose Anbindung an das bestehende System des Kunden, vollautomatischer Datenaustausch.',
  },
  {
    title: 'Implementierung & Rollout',
    description:
      'Begleitung der Einführung direkt im Betrieb – von der Anforderung bis zum produktiven Einsatz.',
  },
] as const;

/** Vorgehensmodell in fünf Schritten. */
export const prozess = [
  {
    step: '01',
    title: 'Analyse',
    description:
      'Tiefes Verständnis des operativen Problems: Prozesse, Systeme, Schnittstellen, Datenflüsse.',
  },
  {
    step: '02',
    title: 'Konzept',
    description: 'Entwicklung des Lösungsdesigns: UI-Konzept, Integrationsarchitektur, Modulstruktur.',
  },
  {
    step: '03',
    title: 'Entwicklung',
    description: 'Iterative Entwicklung des Moduls mit direktem Kundenfeedback.',
  },
  {
    step: '04',
    title: 'Integration',
    description: 'Einbettung in adept&, Anbindung an das ERP-System des Kunden.',
  },
  {
    step: '05',
    title: 'Rollout',
    description: 'Einführung im Betrieb, Mitarbeiterschulung, laufende Optimierung.',
  },
] as const;

/** Technische Leistungen der Plattform. */
export const technischeLeistungen = [
  'Saubere, intuitive Benutzeroberfläche für den Endanwender',
  'Vollständige Integration mit dem ERP- oder SAP-System via API-Schnittstelle',
  'Automatisierter, bidirektionaler Datenaustausch im Hintergrund in Echtzeit',
  'Modularität: jede neue Kundenlösung als eigenständiges Modul in der bestehenden Plattform',
  'Kompatibilität mit allen gängigen ERP-Systemen (SAP, Microsoft Dynamics, infor u. v. m.)',
] as const;

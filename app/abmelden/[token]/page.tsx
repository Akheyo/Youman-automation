import type { Metadata } from 'next';
import Abmeldung from './Abmeldung';

export const metadata: Metadata = { title: 'Abmelden · Youman Automation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Öffentliche Abmeldeseite — der Abmeldelink aus jeder Outreach-Mail landet
 * hier. Bewusst ohne Login, ohne Rückfragen und ohne "Sind Sie sicher?"-Kette:
 * ein Klick, fertig. Die Seite bestätigt nur; der Schreibvorgang läuft über
 * /api/outreach/unsubscribe.
 */
export default function AbmeldenPage({ params }: { params: { token: string } }) {
  return <Abmeldung token={params.token} />;
}

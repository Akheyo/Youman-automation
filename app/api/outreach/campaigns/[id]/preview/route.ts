/**
 * POST → Vorschau der Sequenz für einen echten oder gedachten Kontakt.
 *   Body: { contact_id? } oder { contact: { email, first_name, company, ... } }.
 *   Ohne beides wird ein Beispielkontakt benutzt. Antwort enthält jeden
 *   Schritt fertig gerendert plus die Platzhalter, die keinen Wert hätten —
 *   genau die blockieren später den Versand.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderStep } from '@/lib/outreach/template';
import { unsubscribeUrlFor } from '@/lib/outreach/sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BEISPIEL = {
  email: 'anna.beispiel@musterfirma.de',
  first_name: 'Anna',
  last_name: 'Beispiel',
  company: 'Musterfirma GmbH',
  website: 'https://www.musterfirma.de',
  anlass: 'Ihre Website läuft noch ohne Terminbuchung',
  custom: {},
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Kampagne nicht gefunden.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  let contact: Record<string, unknown> = { ...BEISPIEL };
  if (typeof body.contact_id === 'string') {
    const { data } = await supabase
      .from('outreach_contacts')
      .select('*')
      .eq('id', body.contact_id)
      .eq('user_id', user.id)
      .single();
    if (data) contact = data;
  } else if (body.contact && typeof body.contact === 'object') {
    contact = { ...BEISPIEL, ...(body.contact as Record<string, unknown>) };
  }

  // Entweder die gespeicherte Sequenz oder ein noch nicht gesicherter Entwurf.
  let steps: { step_no: number; delay_days: number; subject: string; body: string }[];
  if (Array.isArray(body.steps)) {
    steps = (body.steps as Record<string, unknown>[]).map((s, i) => ({
      step_no: i + 1,
      delay_days: Number(s.delay_days) || 0,
      subject: String(s.subject ?? ''),
      body: String(s.body ?? ''),
    }));
  } else {
    const { data } = await supabase
      .from('outreach_steps')
      .select('step_no, delay_days, subject, body')
      .eq('campaign_id', params.id)
      .order('step_no', { ascending: true });
    steps = data ?? [];
  }

  const sender = { from_name: campaign.from_name, signature: campaign.signature };
  let firstSubject: string | undefined;
  const preview = steps.map((step) => {
    const r = renderStep(step, contact as never, sender, firstSubject);
    if (step.step_no === 1) firstSubject = r.subject;
    return { step_no: step.step_no, delay_days: step.delay_days, subject: r.subject, body: r.body, missing: r.missing };
  });

  return NextResponse.json({
    contact: { email: contact.email, company: contact.company ?? null },
    steps: preview,
    unsubscribeUrl: unsubscribeUrlFor(String(contact.unsubscribe_token ?? 'beispiel-token')),
  });
}

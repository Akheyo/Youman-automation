/**
 * GET → die Lager (Warehouses), die PlentyONE kennt.
 *
 * Damit lässt sich das Standard-Lager in den Einstellungen auswählen, statt
 * eine ID zu raten. „Leer = das erste" ist eine Annahme, die bei mehreren
 * Lagern still das falsche trifft — und ein Lagerwerkzeug, das im falschen
 * Lager sucht, findet nie etwas und sagt nicht warum.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plentyEingerichtet } from '@/lib/plenty/client';
import { ladeLager } from '@/lib/plenty/lagerorte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Bitte anmelden.' }, { status: 401 });
  }

  if (!(await plentyEingerichtet())) {
    return NextResponse.json({ lager: [], hinweis: 'PlentyONE ist nicht eingerichtet.' });
  }

  try {
    const lager = await ladeLager();
    return NextResponse.json({ lager, hinweis: null });
  } catch (err) {
    // Kein Fehlerstatus: Die Auswahl ist eine Erleichterung, kein Muss. Die
    // Seite soll dann das freie Zahlenfeld zeigen, nicht kaputtgehen.
    return NextResponse.json({
      lager: [],
      hinweis: `Lagerliste nicht abrufbar: ${(err as Error).message.slice(0, 160)}`,
    });
  }
}

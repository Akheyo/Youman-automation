import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { planForUser } from '@/lib/plans';
import { outreachConfigured } from '@/lib/outreach/sender';
import OutreachCockpit from './OutreachCockpit';

export const metadata: Metadata = { title: 'Paul · Cold-Outreach · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function OutreachPage() {
  if (!supabaseConfigured()) redirect('/felix');

  const supabase = createClient()!;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/outreach');

  const { data: profile } = await supabase.from('profiles').select('plan, email_count, full_name').eq('id', user.id).single();
  const plan = planForUser({ plan: profile?.plan, email: user.email });

  return (
    <OutreachCockpit
      email={user.email ?? ''}
      ownerName={profile?.full_name ?? ''}
      planName={plan.name}
      mailsUsed={profile?.email_count ?? 0}
      mailsLimit={plan.emails}
      senderReady={outreachConfigured()}
    />
  );
}

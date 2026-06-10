import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { planFor } from '@/lib/plans';
import { vapiConfigured } from '@/lib/vapi';
import { googleConfigured } from '@/lib/google';
import SalesCockpit from './SalesCockpit';

export const metadata: Metadata = { title: 'Lina · Telefon-Agent · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  if (!supabaseConfigured()) redirect('/felix');

  const supabase = createClient()!;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/sales');

  const { data: profile } = await supabase.from('profiles').select('plan, call_count').eq('id', user.id).single();
  const { data: gt } = await supabase.from('google_tokens').select('email').eq('user_id', user.id).single();
  const plan = planFor(profile?.plan);

  return (
    <SalesCockpit
      email={user.email ?? ''}
      planName={plan.name}
      callsUsed={profile?.call_count ?? 0}
      callsLimit={plan.calls}
      googleEmail={gt?.email ?? null}
      googleConfigured={googleConfigured()}
      vapiReady={vapiConfigured()}
    />
  );
}

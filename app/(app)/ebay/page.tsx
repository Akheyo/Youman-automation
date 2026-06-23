import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import { ebayConfigured, ebayEnv } from '@/lib/ebay/oauth';
import EbayPanel from './EbayPanel';

export const metadata: Metadata = { title: 'eBay-Listings · Youman Automation' };
export const dynamic = 'force-dynamic';

export default async function EbayPage() {
  const { supabase, user } = await requireUser();

  const [{ data: config }, { data: token }, { data: listings }] = await Promise.all([
    supabase.from('ebay_config').select('*').eq('user_id', user.id).single(),
    supabase.from('ebay_tokens').select('connected_at, environment, expires_at').eq('user_id', user.id).single(),
    supabase.from('ebay_listings').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100),
  ]);

  return (
    <EbayPanel
      initialConfig={config ?? null}
      connected={Boolean(token)}
      connection={token ?? null}
      initialListings={listings ?? []}
      appConfigured={ebayConfigured()}
      environment={ebayEnv()}
    />
  );
}

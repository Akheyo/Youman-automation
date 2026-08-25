import { redirect } from 'next/navigation';
import { getUser, supabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Einstieg: eingeloggt → Dashboard, sonst → Login. */
export default async function Home() {
  if (!supabaseConfigured()) redirect('/projekte');
  const user = await getUser();
  redirect(user ? '/projekte' : '/login');
}

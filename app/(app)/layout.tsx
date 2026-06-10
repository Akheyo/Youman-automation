import { redirect } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import AppShell from '@/components/app/AppShell';

export const dynamic = 'force-dynamic';

/**
 * Shared shell for the logged-in app area (Dashboard, Felix, Lina).
 * Provides the persistent sidebar/topbar navigation. The chat (/felix) renders
 * with the `fill` variant so it owns the full height; other pages scroll.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null;

  if (supabaseConfigured()) {
    const supabase = createClient()!;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    email = user.email ?? null;
  }

  return <AppShell email={email}>{children}</AppShell>;
}

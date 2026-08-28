import { redirect } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

export const dynamic = 'force-dynamic';

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

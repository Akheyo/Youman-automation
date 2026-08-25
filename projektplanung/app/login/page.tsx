import { redirect } from 'next/navigation';
import { getUser, supabaseConfigured } from '@/lib/supabase/server';
import AuthForm from './AuthForm';
import styles from './login.module.css';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!supabaseConfigured()) redirect('/projekte');
  const user = await getUser();
  if (user) redirect('/projekte');

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>YP</span>
          <span className={styles.brandText}>Youman Projektplanung</span>
        </div>
        <h1 className={styles.title}>Anmelden</h1>
        <p className={styles.sub}>Projekte erfassen, Kategorien &amp; Artikel in Plenty anlegen.</p>
        <AuthForm />
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getUser, supabaseConfigured } from '@/lib/supabase/server';
import Logo from '@/components/Logo';
import AuthForm from './AuthForm';
import styles from './login.module.css';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!supabaseConfigured()) redirect('/projekte');
  const user = await getUser();
  if (user) redirect('/projekte');

  return (
    <div className={styles.wrap}>
      <div className={styles.accent} aria-hidden />
      <div className={styles.card}>
        <div className={styles.brand}>
          <Logo size="lg" />
        </div>
        <h1 className={styles.title}>Projektplanung</h1>
        <p className={styles.sub}>
          Projekte erfassen und automatisch Kategorie, Artikel und EAN in PlentyONE anlegen.
        </p>
        <AuthForm />
        <p className={styles.foot}>Komplett Konzept Verwertungs GmbH · Interner Bereich</p>
      </div>
    </div>
  );
}

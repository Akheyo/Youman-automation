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
      <aside className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <Logo size="xl" tone="light" />
        </div>
        <div className={styles.brandBody}>
          <h2 className={styles.tagline}>Projektplanung mit direkter PlentyONE-Anbindung</h2>
          <ul className={styles.features}>
            <li>Unterkategorie „Firma&nbsp;Ort“ automatisch anlegen</li>
            <li>Artikel mit Firma, Ort, Datum &amp; Ansprechpartnern</li>
            <li>EAN-13 automatisch erzeugen</li>
          </ul>
        </div>
        <p className={styles.brandFoot}>Komplett Konzept Verwertungs GmbH · Interner Bereich</p>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.formInner}>
          <span className={styles.eyebrow}>Anmeldung</span>
          <h1 className={styles.title}>Willkommen zurück</h1>
          <p className={styles.sub}>Melde dich an, um Projekte zu erfassen und in Plenty anzulegen.</p>
          <AuthForm />
        </div>
      </main>
    </div>
  );
}

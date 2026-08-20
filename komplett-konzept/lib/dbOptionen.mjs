// Verbindungseinstellungen fuer postgres.js - an einer Stelle, damit App und
// Skripte (Migration, Seed, Admin anlegen) sich gleich verhalten.
export function verbindungsOptionen(url = '') {
  const supabase = /supabase\.(co|com)/i.test(url)

  return {
    // Supabase verlangt TLS.
    ssl: supabase ? 'require' : undefined,

    // Der Transaction-Pooler von Supabase (Port 6543) kann keine Prepared
    // Statements. Abschalten kostet hier nichts und erspart Raetselraten.
    prepare: supabase ? false : true,

    // Der Free-Tarif erlaubt 60 Verbindungen insgesamt - sparsam bleiben.
    max: supabase ? 5 : 10,

    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  }
}

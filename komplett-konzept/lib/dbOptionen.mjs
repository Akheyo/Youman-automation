// Verbindungseinstellungen für postgres.js - an einer Stelle, damit App und
// Skripte (Migration, Seed, Admin anlegen) sich gleich verhalten.
//
// Als .mjs geschrieben, weil die Skripte sie ohne Übersetzungsschritt laden.
// Die Typen kommen per JSDoc, damit die App sie trotzdem geprüft bekommt.

/**
 * @param {string} url Verbindungszeichenfolge, entscheidet über die Feineinstellung
 * @returns {import('postgres').Options<{}>}
 */
export function verbindungsOptionen(url = '') {
  const supabase = /supabase\.(co|com)/i.test(url)

  return {
    // Supabase verlangt TLS.
    ssl: supabase ? /** @type {'require'} */ ('require') : undefined,

    // Der Transaction-Pooler von Supabase (Port 6543) kann keine Prepared
    // Statements. Abschalten kostet hier nichts und erspart Rätselraten.
    prepare: !supabase,

    // Der Free-Tarif erlaubt 60 Verbindungen insgesamt - sparsam bleiben.
    max: supabase ? 5 : 10,

    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  }
}

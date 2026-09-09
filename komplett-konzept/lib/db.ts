import postgres from 'postgres'
import { verbindungsOptionen } from './dbOptionen.mjs'

type Sql = ReturnType<typeof postgres>

// Die Verbindung wird erst beim ersten Zugriff aufgebaut, nicht beim Import.
// Wichtig fürs Bauen: "next build" laedt die Module, hat aber keine Datenbank.
declare global {
  // eslint-disable-next-line no-var
  var __kkSql: Sql | undefined
}

let instanz: Sql | undefined

function verbindung(): Sql {
  if (globalThis.__kkSql) return globalThis.__kkSql
  if (instanz) return instanz

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL ist nicht gesetzt - siehe .env.example')
  }

  instanz = postgres(url, verbindungsOptionen(url))

  // Im Dev-Modus über globalThis halten, damit Hot-Reload keine neuen Pools öffnet.
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__kkSql = instanz
  }

  return instanz
}

/**
 * Verhält sich wie das postgres.js-Handle (sql`...`, sql.json(...), sql.begin(...)),
 * baut die Verbindung aber erst auf, wenn wirklich etwas abgefragt wird.
 */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_ziel, _this, argumente: Parameters<Sql>) {
    return Reflect.apply(verbindung() as never, undefined, argumente)
  },
  get(_ziel, eigenschaft) {
    const wert = Reflect.get(verbindung() as object, eigenschaft)
    return typeof wert === 'function' ? wert.bind(verbindung()) : wert
  },
}) as Sql

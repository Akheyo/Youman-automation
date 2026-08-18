/**
 * Gemeinsame Hilfen für Felder, die ihre Daten von einem Endpunkt holen.
 *
 * Die Endpunkte stehen als Vorlage in der Konfiguration und tragen Platzhalter
 * für andere Formularwerte, etwa
 * "/api/v1/search/customers/{customerId}/addresses".
 */

/** Ersetzt {name} durch den aktuellen Formularwert. */
export function resolveEndpoint(endpoint: string, values: Record<string, string>): string {
  return endpoint.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

/** Liefert alle {name}-Platzhalter einer Endpunkt-Vorlage. */
export function extractTemplateParams(endpoint: string): string[] {
  return [...endpoint.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

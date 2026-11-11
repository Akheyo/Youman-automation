/**
 * Meldet einen fertigen Artikel an das Automations-Dashboard — wie es die
 * Make-Szenarien über `lauf_start_make` / `lauf_ende_make` getan haben.
 *
 * Optional: Ohne FOTOSTUDIO_LAUF_URL und FOTOSTUDIO_LAUF_KEY passiert nichts.
 * Und es wirft nie — ein Dashboard, das gerade nicht antwortet, darf keinen
 * fertig angelegten Artikel als Fehler dastehen lassen.
 */

const ZEITLIMIT_MS = 4000;

async function rpc(basis: string, schluessel: string, name: string, koerper: unknown): Promise<void> {
  await fetch(`${basis.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: schluessel,
      Authorization: `Bearer ${schluessel}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(koerper),
    signal: AbortSignal.timeout(ZEITLIMIT_MS),
  });
}

export async function laufMelden(erfolg: boolean, bilderGesamt: number, bilderOk: number): Promise<void> {
  const basis = process.env.FOTOSTUDIO_LAUF_URL;
  const schluessel = process.env.FOTOSTUDIO_LAUF_KEY;
  if (!basis || !schluessel) return;
  const szenario = process.env.FOTOSTUDIO_LAUF_SZENARIO || 'fotostudio-app';
  try {
    await rpc(basis, schluessel, 'lauf_start_make', {
      szenario,
      wie_heisst_es: 'Fotostudio (App)',
      bereich: 'Stammdaten',
    });
    await rpc(basis, schluessel, 'lauf_ende_make', {
      szenario,
      erfolg,
      gesamt: Math.max(bilderGesamt, 1),
      in_ordnung: bilderOk,
      nicht_geklappt: Math.max(bilderGesamt - bilderOk, 0),
    });
  } catch {
    /* Dashboard nicht erreichbar — der Artikel ist trotzdem angelegt. */
  }
}

/**
 * Die Bestellung in die Kueche bringen.
 *
 * Das ist der Punkt, an dem selbstgebaute Bestellsysteme scheitern — nicht an
 * der Bezahlung. Eine Bestellung, die keiner sieht, ist schlimmer als eine
 * Bestellung, die nie angenommen wurde: der Gast hat bezahlt und wartet.
 *
 * Deshalb bewusst zwei Wege, unabhaengig voneinander:
 *   1. Webhook (n8n) → Bondrucker und Signalton auf dem Tablet
 *   2. SMS an die Bestellhotline als Rueckfallebene, wenn 1. nicht quittiert
 *
 * Diese Datei deckt Weg 1 ab. Weg 2 haengt am gewaehlten SMS-Anbieter und ist
 * bewusst noch offen — siehe README, "Was noch fehlt".
 */

export interface KuechenMeldung {
  bestellungId: string;
  nummer: number;
  abholart: string;
  name: string;
  telefon: string;
  adresse: string | null;
  hinweis: string | null;
  summe: number;
  posten: { menge: number; bezeichnung: string }[];
}

/**
 * Meldet eine bezahlte Bestellung an die Kueche.
 *
 * Wirft nie: ein fehlgeschlagener Druck darf den Stripe-Webhook nicht auf
 * Fehler laufen lassen, sonst stellt Stripe stundenlang zu und die Bestellung
 * wird mehrfach gedruckt. Stattdessen `false` — der Aufrufer vermerkt das an
 * der Bestellung, und die Verwaltung zeigt sie als "nicht zugestellt" an.
 */
export async function meldeAnKueche(meldung: KuechenMeldung): Promise<boolean> {
  const url = process.env.KUECHE_WEBHOOK_URL;
  if (!url) return false;

  try {
    const antwort = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.KUECHE_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.KUECHE_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify(meldung),
      signal: AbortSignal.timeout(8000),
    });
    return antwort.ok;
  } catch {
    return false;
  }
}

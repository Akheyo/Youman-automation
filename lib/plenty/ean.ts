/**
 * EAN-13 Erzeugung & Prüfung.
 *
 * Für interne Projekt-Artikel verwenden wir standardmäßig den GS1-Präfixbereich
 * 20–29 ("Restricted distribution / in-store"), der ausdrücklich für die eigene,
 * hausinterne Vergabe reserviert ist und nie mit echten Hersteller-GTINs
 * kollidiert. Der Präfix ist über `PLENTY_EAN_PREFIX` konfigurierbar.
 *
 * Aufbau (13 Stellen): [Präfix 2] + [Nutzlast 10] + [Prüfziffer 1]
 */

/** Berechnet die EAN-13-Prüfziffer für die ersten 12 Stellen. */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) {
    throw new Error('ean13CheckDigit erwartet exakt 12 Ziffern.');
  }
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = first12.charCodeAt(i) - 48; // '0' = 48
    // Positionen (0-basiert): gerade → ×1, ungerade → ×3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Prüft, ob ein String eine gültige EAN-13 (inkl. korrekter Prüfziffer) ist. */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === code.charCodeAt(12) - 48;
}

/**
 * Erzeugt eine gültige EAN-13 aus einem numerischen Seed.
 *
 * @param seed   Eindeutiger Wert (z. B. Zeitstempel + Zufall), aus dem die
 *               10-stellige Nutzlast deterministisch abgeleitet wird.
 * @param prefix 2-stelliger Präfix (Standard 20 – interner Bereich).
 */
export function generateEan13(seed: number | string, prefix = '20'): string {
  const cleanPrefix = String(prefix).replace(/\D/g, '').padStart(2, '0').slice(0, 2);

  // Seed robust in eine 10-stellige, positive Ganzzahl-Zeichenkette überführen.
  let payload: string;
  const numeric = typeof seed === 'number' ? Math.abs(Math.trunc(seed)) : NaN;
  if (Number.isFinite(numeric) && numeric > 0) {
    payload = String(numeric);
  } else {
    // String-Seed → nur Ziffern; falls leer, deterministischer Hash.
    const digitsOnly = String(seed).replace(/\D/g, '');
    payload = digitsOnly || hashToDigits(String(seed));
  }

  payload = payload.slice(-10).padStart(10, '0'); // exakt 10 Stellen
  const first12 = cleanPrefix + payload;
  return first12 + String(ean13CheckDigit(first12));
}

/** Einfache, deterministische Ziffernfolge aus beliebigem Text (Fallback-Seed). */
function hashToDigits(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) % 1_000_000_000;
  }
  return String(h);
}

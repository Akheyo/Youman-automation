/**
 * Verschlüsselung für Zugangsdaten, die in der Datenbank liegen.
 *
 * Warum überhaupt: Das Plenty-Passwort wird künftig in der Oberfläche
 * eingetragen und in Supabase gespeichert. Im Klartext dort abzulegen hieße,
 * dass jeder Datenbank-Auszug — ein Backup, ein versehentlich geteilter
 * Snapshot, ein kompromittiertes Service-Role-Token — das Passwort mit
 * ausliefert. Verschlüsselt ist der Auszug allein wertlos.
 *
 * WAS DAS NICHT LEISTET: Der Schlüssel liegt als Umgebungsvariable auf
 * demselben Server, der auch entschlüsselt. Wer den Server übernimmt, kommt
 * an beides. Diese Verschlüsselung schützt gegen abhandengekommene
 * Datenbank-Inhalte, nicht gegen einen übernommenen Server. Das ist eine
 * bewusste Abwägung, keine Lücke aus Versehen.
 *
 * Verfahren: AES-256-GCM mit zufälligem Salt und IV je Datensatz. GCM prüft
 * beim Entschlüsseln mit, ob am Geheimtext manipuliert wurde.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/** Kennzeichnet das Format, damit ein späterer Wechsel erkennbar bleibt. */
const FORMAT = 'v1';
const ALGO = 'aes-256-gcm';

/**
 * Das Schlüsselmaterial.
 *
 * Bevorzugt `EINSTELLUNGEN_SCHLUESSEL`. Fehlt die Variable, wird ersatzweise
 * der Service-Role-Key von Supabase verwendet — nicht schön, aber der Sinn der
 * Einstellungsseite ist gerade, dass niemand für die Inbetriebnahme erst neue
 * Umgebungsvariablen setzen muss. Wird der Service-Role-Key später gedreht,
 * sind die gespeicherten Passwörter nicht mehr lesbar; die Oberfläche meldet
 * das verständlich und man trägt sie einmal neu ein.
 */
function schluesselmaterial(): string | null {
  const eigen = process.env.EINSTELLUNGEN_SCHLUESSEL?.trim();
  if (eigen) return eigen;
  const ersatz = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return ersatz || null;
}

/** Ob überhaupt verschlüsselt werden kann. */
export function tresorBereit(): boolean {
  return schluesselmaterial() !== null;
}

/** Woher der Schlüssel stammt — die Oberfläche weist darauf hin. */
export function schluesselQuelle(): 'eigen' | 'supabase' | 'keiner' {
  if (process.env.EINSTELLUNGEN_SCHLUESSEL?.trim()) return 'eigen';
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return 'supabase';
  return 'keiner';
}

function abgeleiteterSchluessel(salt: Buffer): Buffer {
  const material = schluesselmaterial();
  if (!material) throw new Error('Kein Schlüssel gesetzt (EINSTELLUNGEN_SCHLUESSEL).');
  // scrypt statt roher Hash: macht das Durchprobieren teuer, falls das
  // Schlüsselmaterial schwach gewählt wurde.
  return scryptSync(material, salt, 32);
}

/**
 * Verschlüsselt einen Klartext. Ergebnis ist ein einzelner String, der Salt,
 * IV und Prüfsumme mitführt — er lässt sich in einer normalen Textspalte
 * ablegen.
 */
export function verschluessele(klartext: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, abgeleiteterSchluessel(salt), iv);
  const geheim = Buffer.concat([cipher.update(klartext, 'utf8'), cipher.final()]);
  const pruefsumme = cipher.getAuthTag();
  return [FORMAT, salt, iv, pruefsumme, geheim].map((t) => (typeof t === 'string' ? t : t.toString('base64'))).join(':');
}

/**
 * Entschlüsselt einen Wert. Gibt null zurück, wenn er nicht lesbar ist —
 * etwa weil der Schlüssel gewechselt wurde oder der Wert beschädigt ist.
 * Wirft bewusst nicht: Ein unlesbares Passwort darf die Seite nicht abstürzen
 * lassen, sondern muss als „bitte neu eintragen" ankommen.
 */
export function entschluessele(gespeichert: string | null | undefined): string | null {
  if (!gespeichert) return null;
  const teile = gespeichert.split(':');
  if (teile.length !== 5 || teile[0] !== FORMAT) return null;
  try {
    const [, salt, iv, pruefsumme, geheim] = teile;
    const decipher = createDecipheriv(ALGO, abgeleiteterSchluessel(Buffer.from(salt, 'base64')), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(pruefsumme, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(geheim, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Zeigt ein Geheimnis so an, dass man es wiedererkennt, ohne es zu verraten:
 * „••••••ab12". Für die Oberfläche — das Passwort selbst wird nie ausgeliefert.
 */
export function maskiere(wert: string | null | undefined): string | null {
  if (!wert) return null;
  if (wert.length <= 4) return '••••';
  return `••••••${wert.slice(-4)}`;
}

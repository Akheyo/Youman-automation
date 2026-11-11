/**
 * EAN aus dem Plenty-Nummernkreis.
 *
 * In Plenty steht unter Einrichtung » Artikel » GTIN, welche GTINs euch
 * gehören (Startwert und Anzahl). Der Knopf „Barcode generieren" an der
 * Variante nimmt daraus die nächste freie Nummer. Diesen Knopf gibt es in der
 * offiziellen REST-API nicht, und den Nummernkreis kann man darüber auch nicht
 * auslesen. Deshalb steht derselbe Kreis hier in der Umgebung, und die App
 * macht, was der Knopf macht: nächste Nummer nehmen, in Plenty prüfen, ob sie
 * schon an einer Variante hängt, sonst die nächste.
 *
 *   FOTOSTUDIO_GTIN_START   12 Stellen (ohne Prüfziffer) oder 13 mit
 *   FOTOSTUDIO_GTIN_ANZAHL  wie viele Nummern der Kreis umfasst
 */

import { ean13CheckDigit } from '@/lib/plenty/ean';

export interface Nummernkreis {
  /** Die ersten 12 Stellen der ersten GTIN, als Zahl. */
  basis: number;
  anzahl: number;
}

export function leseNummernkreis(env: Record<string, string | undefined> = process.env): Nummernkreis | null {
  const roh = (env.FOTOSTUDIO_GTIN_START ?? '').replace(/\s/g, '');
  const anzahl = Number(env.FOTOSTUDIO_GTIN_ANZAHL);
  if (!/^\d{12,13}$/.test(roh) || !Number.isInteger(anzahl) || anzahl < 1) return null;
  const basis = Number(roh.slice(0, 12));
  // Der Kreis darf nicht über zwölf Stellen hinauslaufen — sonst entstünde
  // eine 14-stellige „EAN".
  if (basis + anzahl - 1 > 999_999_999_999) return null;
  return { basis, anzahl };
}

/** Die GTIN an Position `versatz` im Kreis, oder null außerhalb. */
export function gtinAn(kreis: Nummernkreis, versatz: number): string | null {
  if (!Number.isInteger(versatz) || versatz < 0 || versatz >= kreis.anzahl) return null;
  const zwoelf = String(kreis.basis + versatz).padStart(12, '0');
  return zwoelf + String(ean13CheckDigit(zwoelf));
}

/** Position einer GTIN im Kreis, oder null, wenn sie nicht dazugehört. */
export function versatzVon(kreis: Nummernkreis, gtin: string | null | undefined): number | null {
  if (!gtin || !/^\d{13}$/.test(gtin)) return null;
  const versatz = Number(gtin.slice(0, 12)) - kreis.basis;
  return versatz >= 0 && versatz < kreis.anzahl ? versatz : null;
}

/** Erste und letzte GTIN — für die Abfrage „welche haben wir schon vergeben?". */
export function grenzen(kreis: Nummernkreis): { erste: string; letzte: string } {
  return { erste: gtinAn(kreis, 0)!, letzte: gtinAn(kreis, kreis.anzahl - 1)! };
}

// ---------------------------------------------------------------------------
// Plenty-Etikett
// ---------------------------------------------------------------------------

/**
 * Holt das PDF aus Plentys Antwort auf `POST …/variations/{id}/labels`.
 *
 * Dokumentiert ist nur „base64 encoded label", die Hülle nicht. Je nach
 * Version kommt ein nackter String, ein JSON-String, ein Array oder ein Objekt
 * mit dem Inhalt in einem Feld. Alles davon wird akzeptiert — und geprüft, ob
 * am Ende wirklich ein PDF herauskommt.
 */
export function etikettBase64(antwort: unknown): string | null {
  const kandidaten: unknown[] = [antwort];
  for (let i = 0; i < kandidaten.length && i < 20; i += 1) {
    const k = kandidaten[i];
    if (typeof k === 'string') {
      const t = k.trim();
      if (t.startsWith('[') || t.startsWith('{') || t.startsWith('"')) {
        try {
          kandidaten.push(JSON.parse(t));
          continue;
        } catch {
          /* kein JSON — dann vielleicht direkt base64 */
        }
      }
      const rein = t.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
      if (rein.startsWith('JVBER')) return rein; // "%PDF" in base64
    } else if (Array.isArray(k)) {
      kandidaten.push(...k);
    } else if (k && typeof k === 'object') {
      const o = k as Record<string, unknown>;
      for (const feld of ['content', 'base64', 'label', 'pdf', 'data', 'document', 'file']) {
        if (feld in o) kandidaten.push(o[feld]);
      }
    }
  }
  return null;
}

export interface Vorlage {
  id: number;
  name: string;
}

/** Plentys Vorlagenliste in eine feste Form bringen; die Hülle ist undokumentiert. */
export function leseVorlagen(antwort: unknown): Vorlage[] {
  const liste = Array.isArray(antwort)
    ? antwort
    : antwort && typeof antwort === 'object' && Array.isArray((antwort as { entries?: unknown }).entries)
      ? (antwort as { entries: unknown[] }).entries
      : antwort && typeof antwort === 'object'
        ? Object.entries(antwort as Record<string, unknown>).map(([id, name]) => ({ id, name }))
        : [];
  const vorlagen: Vorlage[] = [];
  for (const e of liste) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const id = Number(o.id ?? o.labelId ?? o.templateId);
    const name = String(o.name ?? o.title ?? o.label ?? `Vorlage ${id}`);
    if (Number.isInteger(id) && id > 0) vorlagen.push({ id, name });
  }
  return vorlagen;
}

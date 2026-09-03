/**
 * Liefergebiete, Mindestbestellwerte und Liefergebuehren.
 *
 * Die Startseite wirbt aktuell mit acht Orten (Borken, Gemen, Heiden, Raesfeld,
 * Weseke, Ramsdorf, Burlo, Velen) und "kostenlose Lieferung in Borken ab 20 €".
 * Fuer die uebrigen Orte sind unten Platzhalterwerte hinterlegt — die echten
 * Konditionen gehoeren vor dem Livegang abgeklaert.
 */

export interface Liefergebiet {
  plz: string;
  ort: string;
  /** Mindestbestellwert in Cent. */
  mindestwert: number;
  /** Liefergebuehr in Cent; entfaellt ab `versandfreiAb`. */
  gebuehr: number;
  /** Warenwert in Cent, ab dem nicht mehr berechnet wird. */
  versandfreiAb: number;
}

export const LIEFERGEBIETE: Liefergebiet[] = [
  { plz: '46325', ort: 'Borken', mindestwert: 1000, gebuehr: 0, versandfreiAb: 2000 },
  { plz: '46325', ort: 'Gemen', mindestwert: 1500, gebuehr: 200, versandfreiAb: 2500 },
  { plz: '46359', ort: 'Heiden', mindestwert: 2000, gebuehr: 250, versandfreiAb: 3000 },
  { plz: '46348', ort: 'Raesfeld', mindestwert: 2000, gebuehr: 250, versandfreiAb: 3000 },
  { plz: '46325', ort: 'Weseke', mindestwert: 2000, gebuehr: 250, versandfreiAb: 3000 },
  { plz: '46325', ort: 'Ramsdorf', mindestwert: 2000, gebuehr: 250, versandfreiAb: 3000 },
  { plz: '46325', ort: 'Burlo', mindestwert: 2000, gebuehr: 250, versandfreiAb: 3000 },
  { plz: '46342', ort: 'Velen', mindestwert: 2000, gebuehr: 300, versandfreiAb: 3500 },
];

export function gebietFuer(plz: string, ort: string): Liefergebiet | undefined {
  const o = ort.trim().toLowerCase();
  return LIEFERGEBIETE.find((g) => g.plz === plz.trim() && g.ort.toLowerCase() === o);
}

/** Liefergebuehr fuer einen Warenwert — 0, wenn die Freigrenze erreicht ist. */
export function liefergebuehr(gebiet: Liefergebiet, warenwert: number): number {
  return warenwert >= gebiet.versandfreiAb ? 0 : gebiet.gebuehr;
}

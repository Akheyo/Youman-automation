/**
 * EAN-13 als Strichmuster — für das Etikett, ohne Bibliothek.
 *
 * Ein EAN-13 besteht aus 95 Modulen: Randzeichen (101), sechs Ziffern links,
 * Mittelzeichen (01010), sechs Ziffern rechts, Randzeichen (101). Die erste
 * Ziffer wird nicht als Striche gedruckt, sondern steckt in der Paritätsfolge
 * (L/G) der linken Hälfte.
 */

import { isValidEan13 } from '@/lib/plenty/ean';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITAET = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Die 95 Module als '0'/'1'-Folge. Wirft bei ungültiger EAN. */
export function ean13Module(ean: string): string {
  if (!isValidEan13(ean)) throw new Error(`Keine gültige EAN-13: ${ean}`);
  const z = ean.split('').map(Number);
  const paritaet = PARITAET[z[0]];
  let muster = '101';
  for (let i = 1; i <= 6; i += 1) muster += (paritaet[i - 1] === 'L' ? L : G)[z[i]];
  muster += '01010';
  for (let i = 7; i <= 12; i += 1) muster += R[z[i]];
  return `${muster}101`;
}

/** Zusammenhängende Striche als [Start, Breite] — ergibt weniger SVG-Elemente. */
export function ean13Balken(ean: string): Array<[number, number]> {
  const muster = ean13Module(ean);
  const balken: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= muster.length; i += 1) {
    const schwarz = muster[i] === '1';
    if (schwarz && start < 0) start = i;
    if (!schwarz && start >= 0) {
      balken.push([start, i - start]);
      start = -1;
    }
  }
  return balken;
}

/** Module, an denen die Rand- und Mittelzeichen stehen — sie werden länger gezeichnet. */
export function istFuehrungsmodul(index: number): boolean {
  return index < 3 || (index >= 45 && index < 50) || index >= 92;
}

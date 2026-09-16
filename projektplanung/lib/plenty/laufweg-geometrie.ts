/**
 * Wo die Regale stehen — und wie daraus ein Laufweg wird.
 *
 * Bisher stand die Laufreihenfolge als Namensliste je Halle in
 * laufweg-reihenfolge.ts, dazu eine zweite Liste für die Regale, deren Felder
 * rückwärts gezählt werden. Beides musste der Lagerleiter diktieren, und bei
 * jeder Änderung im Lager wieder.
 *
 * Hier steht stattdessen, wo ein Regal *liegt*: als Strecke mit zwei Enden.
 * Die Reihenfolge und die Feldrichtung rechnet `planeRoute` daraus aus — er
 * geht immer zum nächstgelegenen Regal und betritt es an dem Ende, das ihm
 * am nächsten ist.
 *
 * Das trifft die Realität besser, als es klingt: In Burlo stehen die Regale
 * paarweise als Doppelregal mit einem Gang dazwischen. Wer am Ende von R1
 * steht, hat als Nächstes zwangsläufig das Ende von R2 vor der Nase — also
 * fällt die Schlangenlinie durch die Gänge von selbst heraus.
 *
 * Die Koordinaten stammen aus dem Hallenplan (Stand 10.09.2026) und sind vom
 * Lagerleiter auf den A3-Ausdrucken gegengezeichnet. Einheit ist beliebig,
 * nur das Verhältnis zählt.
 */

/** Ein Punkt in der Halle. */
export type Punkt = readonly [number, number];

/** Ein Regal als Strecke: `a` ist das Ende mit dem niedrigsten Feld. */
export interface RegalOrt {
  name: string;
  a: Punkt;
  b: Punkt;
}

export interface HallenGeometrie {
  /** Wo er die Halle betritt. */
  eingang: Punkt;
  regale: RegalOrt[];
}

/** Ein Regal im fertigen Laufweg. */
export interface RouteSchritt {
  name: string;
  /** false = er läuft die Felder rückwärts, vom höchsten zum niedrigsten. */
  vorwaerts: boolean;
}

const abstand = (p: Punkt, q: Punkt) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/**
 * Rechnet aus den Regalorten die Laufreihenfolge samt Feldrichtung.
 *
 * Verfahren: Vom Eingang aus immer zum Regal mit dem nächstgelegenen Ende,
 * dieses Regal von dort bis zum anderen Ende ablaufen, weiter. Wer am Ende
 * eines Gangs steht, nimmt also das Regal gegenüber und läuft es zurück —
 * genau die Schlangenlinie, die ein Kommissionierer von Hand auch läuft.
 *
 * Bei Gleichstand entscheidet der Name, damit dieselbe Eingabe immer dieselbe
 * Route ergibt und ein zweiter Lauf nichts mehr schreibt.
 */
export function planeRoute(geo: HallenGeometrie): RouteSchritt[] {
  const offen = [...geo.regale];
  const route: RouteSchritt[] = [];
  let hier: Punkt = geo.eingang;

  while (offen.length) {
    let beste = 0;
    let besteDistanz = Infinity;
    let besteVorwaerts = true;

    for (let i = 0; i < offen.length; i++) {
      const r = offen[i];
      const dA = abstand(hier, r.a);
      const dB = abstand(hier, r.b);
      const d = Math.min(dA, dB);
      const naeher = d < besteDistanz - 1e-9;
      const gleich = Math.abs(d - besteDistanz) <= 1e-9;
      if (naeher || (gleich && r.name < offen[beste].name)) {
        beste = i;
        besteDistanz = d;
        besteVorwaerts = dA <= dB;
      }
    }

    const [r] = offen.splice(beste, 1);
    route.push({ name: r.name, vorwaerts: besteVorwaerts });
    hier = besteVorwaerts ? r.b : r.a;
  }

  return route;
}

/**
 * Halle 4 — die KTL-Reihe auf der Lagerbühne.
 *
 * R1KTL steht vorn an der Treppe zum Podest, von dort geht es nach hinten
 * durch bis R15KTL. Ausser R1KTL sind alle Doppelregale: ein Gang trennt
 * immer zwei aufeinanderfolgende Nummern (R1/R2, R3/R4 …).
 *
 * Die Regale liegen waagerecht übereinander, Feld 1 jeweils links.
 */
const H4_KTL: RegalOrt[] = Array.from({ length: 15 }, (_, k) => {
  const nr = k + 1;
  const y = 360 - k * 14;
  return { name: `R${nr}KTL`, a: [118, y] as Punkt, b: [208, y] as Punkt };
});

export const GEOMETRIE: Record<string, HallenGeometrie> = {
  // Er kommt aus Halle 1 und laeuft nach links zur Lagerbuehne; unten rechts
  // an ihrer Ecke steht die Treppe, dort beginnt die Reihe mit R1KTL.
  H4: { eingang: [215, 372], regale: H4_KTL },
};

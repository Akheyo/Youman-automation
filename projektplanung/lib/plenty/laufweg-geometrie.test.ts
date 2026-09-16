/**
 * Prüft, ob die gerechnete Route das trifft, was der Lagerleiter diktiert hat.
 *
 * Das ist der eigentliche Zweck: Nicht die Route von Hand pflegen, sondern sie
 * aus den Regalorten rechnen. Solange die Rechnung bei Halle 4 dasselbe liefert
 * wie die Begehung, taugt sie auch für die anderen Hallen.
 */
import { describe, expect, it } from 'vitest';

import { GEOMETRIE, planeRoute, type HallenGeometrie, type Punkt } from './laufweg-geometrie';

describe('planeRoute', () => {
  it('trifft in Halle 4 genau die diktierte Reihenfolge', () => {
    const route = planeRoute(GEOMETRIE.H4);
    expect(route.map((r) => r.name)).toEqual(
      Array.from({ length: 15 }, (_, k) => `R${k + 1}KTL`),
    );
  });

  it('läuft die Gänge in Schlangenlinie, nicht jedes Regal von vorn', () => {
    // R1 wird von rechts betreten, also rueckwaerts. Am linken Ende steht er
    // dann vor dem linken Ende von R2 — das laeuft er vorwaerts zurueck. Und
    // so fort: die Richtung muss sich bei jedem Regal umdrehen.
    const route = planeRoute(GEOMETRIE.H4);
    for (let i = 1; i < route.length; i++) {
      expect(route[i].vorwaerts).toBe(!route[i - 1].vorwaerts);
    }
  });

  it('betritt ein Regal an dem Ende, das dem Eingang näher liegt', () => {
    const geo: HallenGeometrie = {
      eingang: [100, 0],
      regale: [{ name: 'R1', a: [0, 0] as Punkt, b: [100, 0] as Punkt }],
    };
    expect(planeRoute(geo)).toEqual([{ name: 'R1', vorwaerts: false }]);

    const andersherum: HallenGeometrie = { ...geo, eingang: [0, 0] };
    expect(planeRoute(andersherum)).toEqual([{ name: 'R1', vorwaerts: true }]);
  });

  it('nimmt das nähere Regal zuerst, auch wenn es die höhere Nummer hat', () => {
    const geo: HallenGeometrie = {
      eingang: [0, 0],
      regale: [
        { name: 'R1', a: [500, 0] as Punkt, b: [600, 0] as Punkt },
        { name: 'R9', a: [10, 0] as Punkt, b: [110, 0] as Punkt },
      ],
    };
    expect(planeRoute(geo).map((r) => r.name)).toEqual(['R9', 'R1']);
  });

  it('liefert bei Gleichstand immer dieselbe Route', () => {
    // Zwei Regale exakt gleich weit weg: Ohne feste Regel käme mal das eine,
    // mal das andere zuerst — und jeder Lauf schriebe neue Positionen.
    const geo: HallenGeometrie = {
      eingang: [0, 0],
      regale: [
        { name: 'RB', a: [10, 0] as Punkt, b: [20, 0] as Punkt },
        { name: 'RA', a: [0, 10] as Punkt, b: [0, 20] as Punkt },
      ],
    };
    const erste = planeRoute(geo).map((r) => r.name);
    expect(erste).toEqual(['RA', 'RB']);
    expect(planeRoute(geo).map((r) => r.name)).toEqual(erste);
  });

  it('lässt kein Regal aus', () => {
    const route = planeRoute(GEOMETRIE.H4);
    expect(new Set(route.map((r) => r.name)).size).toBe(GEOMETRIE.H4.regale.length);
  });
});

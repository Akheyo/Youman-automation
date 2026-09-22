import { describe, expect, it } from 'vitest';
import {
  MINDEST_PUNKTE,
  baumAusZeilen,
  bewerte,
  gleichesWort,
  nameAusZeile,
  stamm,
  stecktDrin,
  waehleKategorie,
  woerter,
  type KategorieKnoten,
} from './kategorien';

function knoten(id: number, weg: string[], elternId: number | null = null): KategorieKnoten {
  return { id, name: weg[weg.length - 1], elternId, weg };
}

const baum: KategorieKnoten[] = [
  knoten(1, ['Werkzeug']),
  knoten(2, ['Werkzeug', 'Akkuwerkzeug'], 1),
  knoten(3, ['Werkzeug', 'Akkuwerkzeug', 'Akkuschrauber'], 2),
  knoten(4, ['Verbindungstechnik']),
  knoten(5, ['Verbindungstechnik', 'Schrauben'], 4),
  knoten(6, ['Antriebstechnik']),
  knoten(7, ['Antriebstechnik', 'Pumpen'], 6),
  knoten(8, ['Hydraulik']),
];

describe('woerter', () => {
  it('wirft Fuellwoerter und kurze Brocken raus', () => {
    expect(woerter('Schrauben und Muttern M10')).toEqual(['schrauben', 'muttern']);
  });

  it('macht Umlaute vergleichbar', () => {
    expect(woerter('Türbeschläge')).toEqual(['tuerbeschlaege']);
  });
});

describe('stamm', () => {
  it('haengt die haeufigen Pluralendungen ab', () => {
    expect(stamm('schrauben')).toBe('schraub');
    expect(stamm('pumpen')).toBe('pump');
  });

  it('laesst kurze Woerter in Ruhe', () => {
    expect(stamm('rohr')).toBe('rohr');
  });
});

describe('gleichesWort', () => {
  it('findet Einzahl und Mehrzahl zueinander', () => {
    expect(gleichesWort('schraube', 'schrauben')).toBe(true);
    expect(gleichesWort('pumpe', 'pumpen')).toBe(true);
  });

  it('haelt Verschiedenes auseinander', () => {
    expect(gleichesWort('pumpe', 'lampe')).toBe(false);
  });
});

describe('stecktDrin', () => {
  it('loest deutsche Komposita auf', () => {
    expect(stecktDrin('schrauber', 'akkuschrauber')).toBe(true);
    expect(stecktDrin('pumpen', 'hydraulikpumpe')).toBe(true);
  });

  it('laesst sich von kurzen Bruchstuecken nicht toeppen', () => {
    expect(stecktDrin('teil', 'ersatzteil')).toBe(false);
  });
});

describe('waehleKategorie', () => {
  it('nimmt die genaue Kategorie, nicht die Oberkategorie', () => {
    const w = waehleKategorie(baum, { artikelTyp: 'Akkuschrauber' });
    expect(w.treffer?.id).toBe(3);
  });

  it('findet die Mehrzahl-Kategorie zur Einzahl', () => {
    const w = waehleKategorie(baum, { artikelTyp: 'Schraube' });
    expect(w.treffer?.id).toBe(5);
  });

  it('loest ein Kompositum auf', () => {
    const w = waehleKategorie(baum, { artikelTyp: 'Hydraulikpumpe' });
    expect(w.treffer?.id).toBe(7);
  });

  it('liefert lieber nichts als irgendwas', () => {
    // Ein Staubsauger unter „Hydraulik" waere schlimmer als gar keine Zuordnung.
    const w = waehleKategorie(baum, { artikelTyp: 'Staubsauger' });
    expect(w.treffer).toBeNull();
    expect(w.punkte).toBeLessThan(MINDEST_PUNKTE);
  });

  it('begruendet die Wahl nachvollziehbar', () => {
    const w = waehleKategorie(baum, { artikelTyp: 'Akkuschrauber' });
    expect(w.begruendung.join(' ')).toContain('Werkzeug');
  });

  it('nennt die naechstbesten Kandidaten', () => {
    const w = waehleKategorie(baum, { artikelTyp: 'Akkuschrauber' });
    expect(w.alternativen.length).toBeGreaterThan(0);
  });

  it('kommt mit einem leeren Baum zurecht', () => {
    const w = waehleKategorie([], { artikelTyp: 'Akkuschrauber' });
    expect(w.treffer).toBeNull();
    expect(w.punkte).toBe(0);
  });
});

describe('bewerte', () => {
  it('bewertet einen Treffer auf die Warengattung hoeher als einen Nebentreffer', () => {
    const typ = bewerte(knoten(5, ['Verbindungstechnik', 'Schrauben'], 4), { artikelTyp: 'Schraube' });
    const neben = bewerte(knoten(5, ['Verbindungstechnik', 'Schrauben'], 4), {
      artikelTyp: 'Staubsauger',
      weitere: ['Schrauben'],
    });
    expect(typ.punkte).toBeGreaterThan(neben.punkte);
  });

  it('gibt einer tieferen Kategorie den Vorzug', () => {
    const tief = bewerte(knoten(3, ['Werkzeug', 'Akkuwerkzeug', 'Akkuschrauber'], 2), { artikelTyp: 'Akkuschrauber' });
    const flach = bewerte(knoten(9, ['Akkuschrauber']), { artikelTyp: 'Akkuschrauber' });
    expect(tief.punkte).toBeGreaterThan(flach.punkte);
  });

  it('bewertet ohne Bezug mit null', () => {
    expect(bewerte(knoten(8, ['Hydraulik']), { artikelTyp: 'Bueroschrank' }).punkte).toBe(0);
  });
});

describe('baumAusZeilen', () => {
  it('setzt den vollen Weg zusammen', () => {
    const b = baumAusZeilen([
      { id: 1, parentCategoryId: null, details: [{ lang: 'de', name: 'Werkzeug' }] },
      { id: 2, parentCategoryId: 1, details: [{ lang: 'de', name: 'Akkuwerkzeug' }] },
      { id: 3, parentCategoryId: 2, details: [{ lang: 'de', name: 'Akkuschrauber' }] },
    ]);
    expect(b.find((k) => k.id === 3)?.weg).toEqual(['Werkzeug', 'Akkuwerkzeug', 'Akkuschrauber']);
  });

  it('laesst namenlose Kategorien weg', () => {
    const b = baumAusZeilen([
      { id: 1, parentCategoryId: null, details: [] },
      { id: 2, parentCategoryId: null, details: [{ lang: 'de', name: 'Werkzeug' }] },
    ]);
    expect(b).toHaveLength(1);
  });

  it('laeuft sich an einem Zyklus nicht fest', () => {
    // Ein Baum, der auf sich selbst zeigt, darf die Anlage nicht aufhaengen.
    const b = baumAusZeilen([
      { id: 1, parentCategoryId: 2, details: [{ lang: 'de', name: 'A' }] },
      { id: 2, parentCategoryId: 1, details: [{ lang: 'de', name: 'B' }] },
    ]);
    expect(b).toHaveLength(2);
    expect(b[0].weg.length).toBeLessThanOrEqual(2);
  });

  it('nimmt den deutschen Namen', () => {
    expect(nameAusZeile({ id: 1, details: [{ lang: 'en', name: 'Tools' }, { lang: 'de', name: 'Werkzeug' }] })).toBe(
      'Werkzeug',
    );
  });
});

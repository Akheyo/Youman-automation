import { describe, expect, it } from 'vitest';
import {
  artikelBereit,
  bereitHinweis,
  bildPfad,
  dateiEndung,
  fehlendePflichtbilder,
  istRolle,
  istStatus,
  naechstePosition,
  validiereBild,
  MAX_BILD_BYTES,
} from './logic';

describe('dateiEndung', () => {
  it('nimmt den Content-Type, wenn er brauchbar ist', () => {
    expect(dateiEndung('IMG_0001.HEIC', 'image/jpeg')).toBe('jpg');
  });

  it('erkennt HEIC vom iPhone', () => {
    expect(dateiEndung('IMG_0001', 'image/heic')).toBe('heic');
  });

  it('faellt auf den Dateinamen zurueck', () => {
    expect(dateiEndung('foto.PNG', 'application/octet-stream')).toBe('png');
  });

  it('faellt zuletzt auf jpg zurueck statt zu raten', () => {
    expect(dateiEndung(null, null)).toBe('jpg');
  });
});

describe('bildPfad', () => {
  it('legt je Artikel einen Ordner an und sortiert nach Position', () => {
    expect(bildPfad('abc', 3, 'typenschild', 'jpg')).toBe('abc/03-typenschild.jpg');
  });

  it('bleibt auch jenseits von 99 sortierbar lesbar', () => {
    expect(bildPfad('abc', 100, 'detail', 'jpg')).toBe('abc/100-detail.jpg');
  });
});

describe('validiereBild', () => {
  it('laesst ein normales Handyfoto durch', () => {
    expect(validiereBild({ contentType: 'image/jpeg', groesse: 4_000_000 })).toBeNull();
  });

  it('weist alles ab, was kein Bild ist', () => {
    expect(validiereBild({ contentType: 'application/pdf', groesse: 1000 })).toMatch(/Nur Bilddateien/);
  });

  it('weist leere Dateien ab', () => {
    expect(validiereBild({ contentType: 'image/jpeg', groesse: 0 })).toMatch(/leer/);
  });

  it('nennt bei zu grossen Dateien die tatsaechliche Groesse', () => {
    const meldung = validiereBild({ contentType: 'image/jpeg', groesse: MAX_BILD_BYTES + 1 });
    expect(meldung).toMatch(/zu groß/);
    expect(meldung).toMatch(/30 MB/);
  });
});

describe('naechstePosition', () => {
  it('faengt bei 1 an', () => {
    expect(naechstePosition([])).toBe(1);
  });

  it('vergibt keine Position neu, wenn dazwischen geloescht wurde', () => {
    // Position 2 wurde geloescht (Foto neu gemacht). Die naechste ist trotzdem 4,
    // sonst zeigten zwei Storage-Pfade auf dieselbe Stelle.
    expect(naechstePosition([{ position: 1 }, { position: 3 }])).toBe(4);
  });
});

describe('fehlendePflichtbilder', () => {
  it('verlangt Uebersicht und Typenschild', () => {
    expect(fehlendePflichtbilder([])).toEqual(['uebersicht', 'typenschild']);
  });

  it('zaehlt nur bestaetigt hochgeladene Bilder', () => {
    const bilder = [
      { rolle: 'uebersicht', hochgeladen: true },
      { rolle: 'typenschild', hochgeladen: false }, // haengt in der Warteschlange
    ];
    expect(fehlendePflichtbilder(bilder)).toEqual(['typenschild']);
    expect(artikelBereit(bilder)).toBe(false);
  });

  it('ist zufrieden, sobald beide Pflichtbilder oben sind', () => {
    const bilder = [
      { rolle: 'uebersicht', hochgeladen: true },
      { rolle: 'typenschild', hochgeladen: true },
    ];
    expect(artikelBereit(bilder)).toBe(true);
    expect(bereitHinweis(bilder)).toBeNull();
  });

  it('sagt im Klartext, was fehlt', () => {
    expect(bereitHinweis([{ rolle: 'uebersicht', hochgeladen: true }])).toBe('Es fehlt noch: Typenschild.');
  });
});

describe('Typwaechter', () => {
  it('erkennt gueltige Rollen und Status', () => {
    expect(istRolle('typenschild')).toBe(true);
    expect(istRolle('rueckseite')).toBe(false);
    expect(istStatus('bereit')).toBe(true);
    expect(istStatus('irgendwas')).toBe(false);
  });
});

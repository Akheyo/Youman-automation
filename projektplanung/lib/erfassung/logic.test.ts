import { describe, expect, it } from 'vitest';
import {
  anzahlOben,
  artikelBereit,
  bereitHinweis,
  bildPfad,
  dateiEndung,
  istRolle,
  istStatus,
  naechstePosition,
  normalisiereAngaben,
  validiereBild,
  MAX_BILD_BYTES,
  zustandAbgleichen,
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

describe('artikelBereit', () => {
  it('verlangt mindestens ein Foto', () => {
    expect(artikelBereit([])).toBe(false);
    expect(bereitHinweis([])).toBe('Mindestens ein Foto machen.');
  });

  it('zaehlt nur bestaetigt hochgeladene Bilder', () => {
    // Ein Foto, das noch in der Warteschlange haengt, ist noch keins — sonst
    // ginge der Artikel mit halbem Bildsatz in die Auswertung.
    expect(artikelBereit([{ hochgeladen: false }])).toBe(false);
    expect(anzahlOben([{ hochgeladen: true }, { hochgeladen: false }])).toBe(1);
  });

  it('ist mit einem einzigen Foto zufrieden', () => {
    // Bewusst keine Pflicht-Perspektiven: Was fehlt, sagt die Auswertung
    // hinterher, statt jemanden am Regal eine Kachelliste abarbeiten zu lassen.
    expect(artikelBereit([{ hochgeladen: true }])).toBe(true);
    expect(bereitHinweis([{ hochgeladen: true }])).toBeNull();
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

describe('normalisiereAngaben', () => {
  it('uebernimmt gueltige Angaben', () => {
    expect(
      normalisiereAngaben({
        zustand: 'defekt',
        zustandBestaetigt: true,
        gravierendeSchaeden: false,
        bestand: 7,
        gewichtKg: 2.5,
        packklasse: 'normal',
      }),
    ).toEqual({
      zustand: 'defekt',
      zustandBestaetigt: true,
      gravierendeSchaeden: false,
      bestand: 7,
      gewichtKg: 2.5,
      packklasse: 'normal',
    });
  });

  it('macht aus einem fehlenden Gewicht null, nicht null Kilo', () => {
    // „Nicht gewogen" ist etwas anderes als „wiegt nichts": Nur das erste
    // darf zu einem Artikel ohne Versandprofil fuehren statt zu einem mit
    // falschem.
    expect(normalisiereAngaben({}).gewichtKg).toBeNull();
    expect(normalisiereAngaben({ gewichtKg: 0 }).gewichtKg).toBeNull();
    expect(normalisiereAngaben({ gewichtKg: -3 }).gewichtKg).toBeNull();
    expect(normalisiereAngaben({ gewichtKg: 'schwer' }).gewichtKg).toBeNull();
  });

  it('rundet das Gewicht auf Gramm und deckelt Zahlendreher', () => {
    expect(normalisiereAngaben({ gewichtKg: 2.4567 }).gewichtKg).toBe(2.457);
    expect(normalisiereAngaben({ gewichtKg: 2500 }).gewichtKg).toBe(300);
  });

  it('laesst die Packklasse erst ueber zehn Kilo gelten', () => {
    // Darunter kostet jede Sendung denselben Satz — „sperrig" an einer
    // 2-kg-Sendung waere eine Angabe, die nichts bewirkt.
    expect(normalisiereAngaben({ gewichtKg: 2, packklasse: 'sperrig' }).packklasse).toBe('normal');
    expect(normalisiereAngaben({ gewichtKg: 25, packklasse: 'sperrig' }).packklasse).toBe('sperrig');
  });

  it('faellt bei unbekannter Packklasse auf normal zurueck', () => {
    expect(normalisiereAngaben({ gewichtKg: 25, packklasse: 'riesig' }).packklasse).toBe('normal');
  });

  it('faellt bei unbekanntem Zustand auf gebraucht zurueck', () => {
    // Bei einer Verwertung der Regelfall — ein erfundener Wert waere schlimmer.
    expect(normalisiereAngaben({ zustand: 'irgendwas' }).zustand).toBe('gebraucht');
    expect(normalisiereAngaben({}).zustand).toBe('gebraucht');
  });

  it('merkt sich, ob jemand den Zustand bestaetigt hat', () => {
    // Sonst liesse sich nicht unterscheiden, ob "gebraucht" eine Aussage war
    // oder nur niemand hingesehen hat.
    expect(normalisiereAngaben({}).zustandBestaetigt).toBe(false);
    expect(normalisiereAngaben({ zustandBestaetigt: true }).zustandBestaetigt).toBe(true);
    expect(normalisiereAngaben({ zustandBestaetigt: 'ja' }).zustandBestaetigt).toBe(false);
  });

  it('laesst gravierende Schaeden nur bei Gebrauchtware gelten', () => {
    // Bei neuer Ware ergibt es keinen Sinn, bei defekter zoege der Faktor doppelt ab.
    expect(normalisiereAngaben({ zustand: 'gebraucht', gravierendeSchaeden: true }).gravierendeSchaeden).toBe(true);
    expect(normalisiereAngaben({ zustand: 'neu', gravierendeSchaeden: true }).gravierendeSchaeden).toBe(false);
    expect(normalisiereAngaben({ zustand: 'defekt', gravierendeSchaeden: true }).gravierendeSchaeden).toBe(false);
  });

  it('haelt den Bestand in vernuenftigen Grenzen', () => {
    expect(normalisiereAngaben({ bestand: 0 }).bestand).toBe(1);
    expect(normalisiereAngaben({ bestand: -5 }).bestand).toBe(1);
    expect(normalisiereAngaben({ bestand: 2.6 }).bestand).toBe(3);
    expect(normalisiereAngaben({ bestand: 99999 }).bestand).toBe(9999);
    expect(normalisiereAngaben({ bestand: 'viele' }).bestand).toBe(1);
    expect(normalisiereAngaben({}).bestand).toBe(1);
  });
});

describe('zustandAbgleichen', () => {
  it('meldet als neu erfasste Ware, die auf den Fotos gebraucht aussieht', () => {
    // Der Fall, der wirklich wehtut: kein Gebrauchtabschlag, und im Listing
    // steht „Neuware, unbenutzt" ueber einem Artikel mit Kratzern.
    const a = zustandAbgleichen('neu', 'gebraucht_gut', ['Kratzer am Gehaeuse']);
    expect(a.widerspruch).toBe(true);
    expect(a.hinweis).toContain('zu hoch');
    expect(a.hinweis).toContain('1 Schaden');
  });

  it('meldet auch neu_versiegelt gegen Gebrauchsspuren', () => {
    expect(zustandAbgleichen('neu_versiegelt', 'gebraucht_spuren').widerspruch).toBe(true);
  });

  it('schweigt, wenn beide Urteile zusammenpassen', () => {
    expect(zustandAbgleichen('gebraucht', 'gebraucht_gut').widerspruch).toBe(false);
    expect(zustandAbgleichen('gebraucht', 'gebraucht_spuren').widerspruch).toBe(false);
    expect(zustandAbgleichen('neu', 'neuwertig').widerspruch).toBe(false);
  });

  it('schweigt, wenn der Mensch strenger ist als die Kamera', () => {
    // Zu vorsichtig verkaufen kostet Marge, nicht Vertrauen — und wer das
    // Teil in der Hand hatte, weiss mehr als die Kamera.
    expect(zustandAbgleichen('gebraucht', 'neuwertig').widerspruch).toBe(false);
    expect(zustandAbgleichen('defekt', 'gebraucht_gut').widerspruch).toBe(false);
  });

  it('meldet stark gebraucht gegen gebraucht', () => {
    expect(zustandAbgleichen('gebraucht', 'stark_gebraucht').widerspruch).toBe(true);
  });

  it('meldet defekt auf den Fotos gegen gebraucht in der Erfassung', () => {
    expect(zustandAbgleichen('gebraucht', 'defekt').widerspruch).toBe(true);
  });

  it('macht aus einem unklaren Kamera-Urteil keinen Widerspruch', () => {
    expect(zustandAbgleichen('neu', 'unbekannt').widerspruch).toBe(false);
    expect(zustandAbgleichen('neu', null).widerspruch).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isLikelyPrefetch, pixelGif, pixelUrlFor, newTrackToken, VORABLADER_FENSTER_MS } from '@/lib/outreach/tracking';

const APPLE_MAIL = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const GMAIL_PROXY = 'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)';

describe('pixelGif', () => {
  it('liefert ein gueltiges GIF', () => {
    const bytes = new Uint8Array(pixelGif());
    expect(bytes.length).toBeGreaterThan(30);
    // GIF89a-Kennung am Dateianfang.
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
  });
});

describe('isLikelyPrefetch', () => {
  const versendet = new Date('2026-01-14T09:00:00Z');

  it('wertet einen Abruf ohne Kennung als Maschine', () => {
    expect(isLikelyPrefetch({ userAgent: null })).toBe(true);
    expect(isLikelyPrefetch({ userAgent: '' })).toBe(true);
  });

  it('erkennt Sicherheitsscanner an der Kennung', () => {
    for (const ua of ['Proofpoint-Scanner/1.0', 'Mimecast', 'barracuda-fetch', 'python-requests/2.31', 'curl/8.4.0']) {
      expect(isLikelyPrefetch({ userAgent: ua })).toBe(true);
    }
  });

  it('wertet einen Abruf unmittelbar nach dem Versand als Vorablader', () => {
    const gleichDanach = new Date(versendet.getTime() + 2_000);
    expect(isLikelyPrefetch({ userAgent: APPLE_MAIL, sentAt: versendet, now: gleichDanach })).toBe(true);
  });

  it('laesst einen Abruf nach dem Vorablader-Fenster als Oeffnung durch', () => {
    const spaeter = new Date(versendet.getTime() + VORABLADER_FENSTER_MS + 1_000);
    expect(isLikelyPrefetch({ userAgent: APPLE_MAIL, sentAt: versendet, now: spaeter })).toBe(false);
  });

  it('behandelt Gmails Bild-Proxy als echte Oeffnung', () => {
    // Gmail laedt das Bild erst, wenn die Mail geoeffnet wird.
    const spaeter = new Date(versendet.getTime() + 60_000);
    expect(isLikelyPrefetch({ userAgent: GMAIL_PROXY, sentAt: versendet, now: spaeter })).toBe(false);
  });

  it('kommt ohne Versandzeitpunkt aus', () => {
    expect(isLikelyPrefetch({ userAgent: APPLE_MAIL })).toBe(false);
  });

  it('laesst sich von einem Zeitstempel in der Zukunft nicht aus dem Tritt bringen', () => {
    const vorher = new Date(versendet.getTime() - 60_000);
    expect(isLikelyPrefetch({ userAgent: APPLE_MAIL, sentAt: versendet, now: vorher })).toBe(false);
  });

  it('nimmt den Versandzeitpunkt auch als Zeichenkette an', () => {
    const gleichDanach = new Date(versendet.getTime() + 1_000);
    expect(isLikelyPrefetch({ userAgent: APPLE_MAIL, sentAt: versendet.toISOString(), now: gleichDanach })).toBe(true);
  });
});

describe('pixelUrlFor', () => {
  const alt = process.env.APP_URL;
  beforeEach(() => {
    process.env.APP_URL = 'https://app.example.de/';
  });
  afterEach(() => {
    process.env.APP_URL = alt;
  });

  it('baut eine absolute URL mit .gif-Endung', () => {
    expect(pixelUrlFor('abc123')).toBe('https://app.example.de/api/outreach/p/abc123.gif');
  });

  it('liefert ohne APP_URL oder Token nichts', () => {
    expect(pixelUrlFor('')).toBeNull();
    process.env.APP_URL = '';
    expect(pixelUrlFor('abc')).toBeNull();
  });
});

describe('newTrackToken', () => {
  it('erzeugt ein Token ohne Bindestriche, das sich nicht wiederholt', () => {
    const a = newTrackToken();
    const b = newTrackToken();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

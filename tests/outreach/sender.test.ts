import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { buildText, buildHtml, fromHeader, escapeHtml, unsubscribeUrlFor, oneClickUrlFor, outreachConfigured, sendOutreachMail } from '@/lib/outreach/sender';

const basis = { to: 'anna@firma.de', subject: 'Kurze Frage', body: 'Hallo Anna,\n\nkurze Frage.' };

describe('escapeHtml', () => {
  it('entschaerft HTML aus dem Vorlagentext', () => {
    expect(escapeHtml('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  });
});

describe('buildText / buildHtml', () => {
  it('haengt den Abmeldehinweis an den Text', () => {
    const text = buildText({ ...basis, unsubscribeUrl: 'https://app.de/abmelden/abc' });
    expect(text).toContain('kurze Frage.');
    expect(text).toContain('https://app.de/abmelden/abc');
  });

  it('laesst den Text unveraendert, wenn kein Abmeldelink vorliegt', () => {
    expect(buildText(basis)).toBe('Hallo Anna,\n\nkurze Frage.');
  });

  it('setzt den Abmeldelink als Link ins HTML', () => {
    const html = buildHtml({ ...basis, unsubscribeUrl: 'https://app.de/abmelden/abc' });
    expect(html).toContain('href="https://app.de/abmelden/abc"');
    expect(html).toContain('white-space:pre-wrap');
  });

  it('schleust kein rohes HTML aus dem Text durch', () => {
    expect(buildHtml({ ...basis, body: '<script>alert(1)</script>' })).not.toContain('<script>');
  });

  it('haengt das Zaehlpixel nur an, wenn eine Pixel-URL vorliegt', () => {
    expect(buildHtml(basis)).not.toContain('<img');
    const html = buildHtml({ ...basis, trackingPixelUrl: 'https://app.de/api/outreach/p/tok.gif' });
    expect(html).toContain('src="https://app.de/api/outreach/p/tok.gif"');
    expect(html).toContain('width="1"');
  });

  it('haelt das Pixel aus dem Nur-Text-Teil heraus', () => {
    expect(buildText({ ...basis, trackingPixelUrl: 'https://app.de/api/outreach/p/tok.gif' })).not.toContain('p/tok.gif');
  });
});

describe('fromHeader', () => {
  it('baut Name und Adresse zusammen', () => {
    expect(fromHeader({ ...basis, fromName: 'Max Muster', fromEmail: 'max@firma.de' })).toBe('Max Muster <max@firma.de>');
  });

  it('kommt auch mit nur einem der beiden Werte aus', () => {
    expect(fromHeader({ ...basis, fromEmail: 'max@firma.de' })).toBe('max@firma.de');
    expect(fromHeader({ ...basis, fromName: 'Max' })).toBe('Max');
    expect(fromHeader(basis)).toBeUndefined();
  });
});

describe('Abmelde-URLs', () => {
  const alt = process.env.APP_URL;
  beforeEach(() => {
    process.env.APP_URL = 'https://app.example.de/';
  });
  afterEach(() => {
    process.env.APP_URL = alt;
  });

  it('zeigt auf die Bestaetigungsseite bzw. den Ein-Klick-Endpunkt', () => {
    expect(unsubscribeUrlFor('abc123')).toBe('https://app.example.de/abmelden/abc123');
    expect(oneClickUrlFor('abc123')).toBe('https://app.example.de/api/outreach/unsubscribe?token=abc123');
  });

  it('liefert ohne APP_URL oder ohne Token nichts', () => {
    expect(unsubscribeUrlFor('')).toBeNull();
    process.env.APP_URL = '';
    expect(unsubscribeUrlFor('abc')).toBeNull();
  });
});

describe('sendOutreachMail', () => {
  const altWebhook = process.env.OUTREACH_WEBHOOK_URL;
  const altPitch = process.env.FELIX_PITCH_WEBHOOK_URL;

  beforeEach(() => {
    process.env.OUTREACH_WEBHOOK_URL = 'https://hook.example.de/mail';
    delete process.env.FELIX_PITCH_WEBHOOK_URL;
  });
  afterEach(() => {
    process.env.OUTREACH_WEBHOOK_URL = altWebhook;
    process.env.FELIX_PITCH_WEBHOOK_URL = altPitch;
    vi.unstubAllGlobals();
  });

  it('gilt als konfiguriert, sobald ein Webhook gesetzt ist', () => {
    expect(outreachConfigured()).toBe(true);
    delete process.env.OUTREACH_WEBHOOK_URL;
    expect(outreachConfigured()).toBe(false);
    process.env.FELIX_PITCH_WEBHOOK_URL = 'https://hook.example.de/pitch';
    expect(outreachConfigured()).toBe(true);
  });

  it('schickt Betreff, Text, HTML und die Abmelde-Header an den Webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: '<abc@firma.de>' }) });
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendOutreachMail({
      ...basis,
      unsubscribeUrl: 'https://app.de/abmelden/abc',
      oneClickUrl: 'https://app.de/api/outreach/unsubscribe?token=abc',
    });

    expect(res).toEqual({ ok: true, messageId: '<abc@firma.de>' });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.to).toBe('anna@firma.de');
    expect(body.subject).toBe('Kurze Frage');
    expect(body.headers['List-Unsubscribe']).toBe('<https://app.de/api/outreach/unsubscribe?token=abc>');
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('haengt Folgemails ueber In-Reply-To an den Verlauf', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await sendOutreachMail({ ...basis, inReplyTo: '<erste@firma.de>' });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.headers['In-Reply-To']).toBe('<erste@firma.de>');
    expect(body.headers['References']).toBe('<erste@firma.de>');
  });

  it('verweigert ungueltige Adressen und leere Betreffs, ohne zu senden', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendOutreachMail({ ...basis, to: 'kaputt' })).toMatchObject({ ok: false });
    expect(await sendOutreachMail({ ...basis, subject: '  ' })).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('meldet einen Fehlercode des Webhooks als Fehler zurueck', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    expect(await sendOutreachMail(basis)).toEqual({ ok: false, error: 'Versand-Webhook antwortete mit HTTP 500.' });
  });

  it('faengt Netzwerkfehler ab, statt zu werfen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Verbindung abgebrochen')));
    expect(await sendOutreachMail(basis)).toEqual({ ok: false, error: 'Verbindung abgebrochen' });
  });

  it('sagt Bescheid, wenn gar kein Versandweg konfiguriert ist', async () => {
    delete process.env.OUTREACH_WEBHOOK_URL;
    const res = await sendOutreachMail(basis);
    expect(res).toMatchObject({ ok: false });
    expect((res as { error: string }).error).toContain('OUTREACH_WEBHOOK_URL');
  });
});

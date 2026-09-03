import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendNextStep, type OutreachCampaign, type OutreachContact, type OutreachStep } from '@/lib/outreach/queue';

/**
 * Kleiner Supabase-Ersatz: hält Sperrliste, Kontakt-Updates und Ereignisse im
 * Speicher und bildet genau die Aufrufkette nach, die `sendNextStep` benutzt.
 */
function fakeDb(opts: { blocked?: string[] } = {}) {
  const updates: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const blocked = new Set(opts.blocked ?? []);

  const sb = {
    from(table: string) {
      if (table === 'outreach_suppression') {
        let email = '';
        const chain = {
          select: () => chain,
          eq: (col: string, val: string) => {
            if (col === 'email') email = val;
            return chain;
          },
          maybeSingle: async () => ({ data: blocked.has(email) ? { email } : null }),
        };
        return chain;
      }
      if (table === 'outreach_contacts') {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              updates.push(patch);
              return { data: null, error: null };
            },
          }),
        };
      }
      if (table === 'outreach_events') {
        return {
          insert: async (row: Record<string, unknown>) => {
            events.push(row);
            return { data: null, error: null };
          },
        };
      }
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
  };

  return { sb: sb as unknown as SupabaseClient, updates, events };
}

const campaign: OutreachCampaign = {
  id: 'k1',
  user_id: 'u1',
  name: 'Test',
  status: 'aktiv',
  from_name: 'Max Muster',
  from_email: 'max@firma.de',
  reply_to: null,
  signature: 'Viele Grüße\nMax',
  window_start: 8,
  window_end: 18,
  timezone: 'Europe/Berlin',
  send_on_weekend: false,
  max_per_day: 40,
  stop_on_reply: true,
};

const steps: OutreachStep[] = [
  { step_no: 1, delay_days: 0, subject: 'Frage zu {{firma}}', body: 'Hallo {{vorname}},\n\nkurze Frage.' },
  { step_no: 2, delay_days: 3, subject: '', body: 'Ich hake kurz nach.' },
];

function contact(over: Partial<OutreachContact> = {}): OutreachContact {
  return {
    id: 'c1',
    campaign_id: 'k1',
    email: 'anna@firma.de',
    first_name: 'Anna',
    company: 'Firma GmbH',
    status: 'neu',
    current_step: 0,
    unsubscribe_token: 'tok123',
    ...over,
  } as OutreachContact;
}

// Mittwoch 10:00 Berliner Zeit — mitten im Versandfenster.
const jetzt = new Date('2026-01-14T09:00:00Z');

describe('sendNextStep', () => {
  beforeEach(() => {
    process.env.OUTREACH_WEBHOOK_URL = 'https://hook.example.de/mail';
    process.env.APP_URL = 'https://app.example.de';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verschickt Schritt 1 und plant Schritt 2 ein', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: '<m1@firma.de>' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { sb, updates, events } = fakeDb();

    const res = await sendNextStep(sb, { campaign, steps, contact: contact(), now: jetzt });

    expect(res).toMatchObject({ ok: true, step_no: 1, subject: 'Frage zu Firma GmbH', done: false });
    const patch = updates[0]!;
    expect(patch).toMatchObject({ current_step: 1, status: 'aktiv', thread_subject: 'Frage zu Firma GmbH', message_id: '<m1@firma.de>' });
    // Nächster Schritt: drei Tage später, also Samstag → auf Montag geschoben.
    expect(new Date(patch.next_send_at as string).getTime()).toBeGreaterThan(jetzt.getTime());
    expect(events[0]).toMatchObject({ kind: 'gesendet', step_no: 1 });
  });

  it('setzt den Kontakt nach dem letzten Schritt auf fertig', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const { sb, updates } = fakeDb();

    const res = await sendNextStep(sb, { campaign, steps, contact: contact({ current_step: 1, status: 'aktiv' }), now: jetzt });

    expect(res).toMatchObject({ ok: true, step_no: 2, done: true });
    expect(updates[0]).toMatchObject({ status: 'fertig', next_send_at: null });
  });

  it('haengt das Follow-up als Re: an den Verlauf der Erstmail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { sb } = fakeDb();

    await sendNextStep(sb, {
      campaign,
      steps,
      contact: contact({ current_step: 1, status: 'aktiv', thread_subject: 'Frage zu Firma GmbH', message_id: '<m1@firma.de>' }),
      now: jetzt,
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.subject).toBe('Re: Frage zu Firma GmbH');
    expect(body.headers['In-Reply-To']).toBe('<m1@firma.de>');
  });

  it('schreibt niemanden an, der auf der Sperrliste steht', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { sb, updates, events } = fakeDb({ blocked: ['anna@firma.de'] });

    const res = await sendNextStep(sb, { campaign, steps, contact: contact(), now: jetzt });

    expect(res).toMatchObject({ ok: false, fatal: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ status: 'abgemeldet', next_send_at: null });
    expect(events[0]).toMatchObject({ kind: 'abgemeldet' });
  });

  it('haelt einen Kontakt an, statt eine Mail mit Luecke zu verschicken', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { sb, updates, events } = fakeDb();

    const res = await sendNextStep(sb, { campaign, steps, contact: contact({ first_name: null }), now: jetzt });

    expect(res).toMatchObject({ ok: false, fatal: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ status: 'gestoppt' });
    expect(String(updates[0]!.last_error)).toContain('vorname');
    expect(events[0]).toMatchObject({ kind: 'fehler' });
  });

  it('setzt einen Zustellfehler auf spaeter, ohne den Kontakt zu verlieren', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const { sb, updates } = fakeDb();

    const res = await sendNextStep(sb, { campaign, steps, contact: contact(), now: jetzt });

    expect(res).toMatchObject({ ok: false, fatal: false });
    expect(updates[0]).toMatchObject({ fails: 1, status: 'neu' });
    expect(new Date(updates[0]!.next_send_at as string).getTime()).toBeGreaterThan(jetzt.getTime());
  });

  it('gibt nach dem dritten Fehlversuch auf', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const { sb, updates } = fakeDb();

    const res = await sendNextStep(sb, { campaign, steps, contact: contact({ fails: 2 }), now: jetzt });

    expect(res).toMatchObject({ ok: false, fatal: true });
    expect(updates[0]).toMatchObject({ fails: 3, status: 'gestoppt', next_send_at: null });
  });

  it('meldet einen Kontakt als fertig, wenn die Sequenz keinen weiteren Schritt hat', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { sb, updates } = fakeDb();

    const res = await sendNextStep(sb, { campaign, steps, contact: contact({ current_step: 2 }), now: jetzt });

    expect(res).toMatchObject({ ok: false, fatal: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ status: 'fertig' });
  });

  it('legt Abmeldelink und Signatur in jede Mail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { sb } = fakeDb();

    await sendNextStep(sb, { campaign, steps, contact: contact(), now: jetzt });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.text).toContain('Viele Grüße\nMax');
    expect(body.text).toContain('https://app.example.de/abmelden/tok123');
    expect(body.headers['List-Unsubscribe']).toContain('/api/outreach/unsubscribe?token=tok123');
    expect(body.from).toBe('Max Muster <max@firma.de>');
  });
});

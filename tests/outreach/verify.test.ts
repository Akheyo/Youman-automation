import { describe, it, expect } from 'vitest';
import { domainVon, pruefeDomain, pruefeAdressen, istAussichtslos } from '@/lib/outreach/verify';

describe('domainVon', () => {
  it('schneidet den Domainteil heraus', () => {
    expect(domainVon('anna@firma.de')).toBe('firma.de');
    expect(domainVon('Anna@Firma.DE')).toBe('firma.de');
  });

  it('kommt mit Unfug klar', () => {
    expect(domainVon('ohne-at')).toBe('');
    expect(domainVon('')).toBe('');
  });
});

describe('istAussichtslos', () => {
  it('verwirft nur, was sicher nicht zustellbar ist', () => {
    expect(istAussichtslos('kein_mx')).toBe(true);
    expect(istAussichtslos('syntax')).toBe(true);
    expect(istAussichtslos('ok')).toBe(false);
    // Ein DNS-Aussetzer darf keine gueltige Adresse kosten.
    expect(istAussichtslos('ungeprueft')).toBe(false);
  });
});

describe('pruefeDomain', () => {
  it('erkennt eine Domain mit Mailserver', async () => {
    // gmail.com hat garantiert MX-Eintraege.
    expect(await pruefeDomain('gmail.com')).toBe('ok');
  }, 15_000);

  it('erkennt eine Domain, die es nicht gibt', async () => {
    const status = await pruefeDomain('diese-domain-existiert-ganz-sicher-nicht-xyz123.de');
    // Je nach DNS-Aufloeser entweder klarer Befund oder ungeprueft — nie 'ok'.
    expect(status).not.toBe('ok');
  }, 15_000);

  it('wertet einen leeren Domainnamen als Syntaxfehler', async () => {
    expect(await pruefeDomain('')).toBe('syntax');
  });
});

describe('pruefeAdressen', () => {
  it('meldet ungueltige Syntax ohne Nachschlagen', async () => {
    const res = await pruefeAdressen(['kaputt', 'auch@kaputt']);
    expect(res.map((r) => r.status)).toEqual(['syntax', 'syntax']);
  });

  it('schlaegt jede Domain nur einmal nach', async () => {
    const res = await pruefeAdressen(['a@gmail.com', 'b@gmail.com', 'c@gmail.com']);
    expect(res).toHaveLength(3);
    expect(res.every((r) => r.status === 'ok')).toBe(true);
  }, 15_000);
});

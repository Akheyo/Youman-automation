import { describe, it, expect } from 'vitest';
import { VORLAGEN, STARTER_SEQUENCE, SIGNATUR_VORLAGE, vorlage } from '@/lib/outreach/presets';
import { renderStep, usedPlaceholders } from '@/lib/outreach/template';

const vollstaendig = {
  email: 'tim.kaldeuer@asmetal.de',
  first_name: 'Tim',
  last_name: 'Kaldeuer',
  company: 'August Schmits GmbH & Co. KG',
  website: 'https://www.asmetal.de',
  anlass: null,
  custom: { branche: 'Automobil & Zulieferer', ort: 'Mettmann' },
};

describe('Vorlagen', () => {
  it('bieten vier Sequenzen mit je vier Schritten in der Reihenfolge 0/3/7/14', () => {
    expect(VORLAGEN.map((v) => v.id)).toEqual(['onlinehandel', 'stunden', 'beobachtung', 'besuch']);
    for (const v of VORLAGEN) {
      expect(v.steps.map((s) => s.step_no)).toEqual([1, 2, 3, 4]);
      expect(v.steps.map((s) => s.delay_days)).toEqual([0, 3, 7, 14]);
    }
  });

  it('haben nur in der Erstmail einen Betreff — Nachfassen laeuft im Verlauf', () => {
    for (const v of VORLAGEN) {
      expect(v.steps[0]!.subject.length).toBeGreaterThan(0);
      for (const s of v.steps.slice(1)) expect(s.subject).toBe('');
    }
  });

  it('enthalten keine eckigen Klammern — nichts, was noch ausgefuellt werden muesste', () => {
    for (const v of VORLAGEN) for (const s of v.steps) expect(s.body + s.subject).not.toMatch(/\[[^\]]+\]/);
  });

  it('rendern fuer einen vollstaendigen Kontakt ohne Luecken', () => {
    for (const v of VORLAGEN) {
      let erstbetreff: string | undefined;
      for (const s of v.steps) {
        const r = renderStep(s, vollstaendig, { from_name: 'Amanuel Kheyo', signature: SIGNATUR_VORLAGE }, erstbetreff);
        expect(r.missing, `${v.id} Schritt ${s.step_no}`).toEqual([]);
        expect(r.body).toContain('Guten Tag Tim Kaldeuer,');
        expect(r.body).toContain('46325 Borken');
        if (s.step_no === 1) erstbetreff = r.subject;
        else expect(r.subject.startsWith('Re: ')).toBe(true);
      }
    }
  });

  it('halten einen Kontakt ohne Namen an, statt "Guten Tag ," zu senden', () => {
    const ohne = { ...vollstaendig, first_name: null, last_name: null };
    const r = renderStep(VORLAGEN[0]!.steps[0]!, ohne);
    expect(r.missing).toEqual(['vorname', 'nachname']);
  });

  it('halten die Betreff-Regeln ein: kurz, klein, keine Zahl, kein Ausrufezeichen', () => {
    for (const v of VORLAGEN) {
      const b = v.steps[0]!.subject;
      expect(b).toBe(b.toLowerCase());
      expect(b).not.toMatch(/[!?]/);
      expect(b).not.toMatch(/\d/);
      expect(b.replace(/\{\{[^}]+\}\}/g, 'x').split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });

  it('kommen ohne Gedankenstrich aus, der nach Maschine klingt', () => {
    for (const v of VORLAGEN) for (const s of v.steps) {
      expect(s.body + s.subject, `${v.id} Schritt ${s.step_no}`).not.toContain('—');
    }
    expect(SIGNATUR_VORLAGE).not.toContain('—');
  });

  it('vermeiden die Nachfass-Floskeln, die Antworten kosten', () => {
    const verboten = /nachhaken|nochmal nach oben|haben sie meine|nur kurz nachfragen|checking in/i;
    for (const v of VORLAGEN) for (const s of v.steps) expect(s.body).not.toMatch(verboten);
  });

  it('nutzen nur Platzhalter, die es im Kontakt gibt', () => {
    const bekannt = new Set(['vorname', 'nachname', 'firma', 'branche', 'ort', 'anlass', 'website', 'domain']);
    for (const v of VORLAGEN) for (const s of v.steps) {
      for (const p of usedPlaceholders(s.subject + ' ' + s.body)) expect(bekannt.has(p), `${v.id}: {{${p}}}`).toBe(true);
    }
  });

  it('findet eine Vorlage ueber ihre Kennung', () => {
    expect(vorlage('onlinehandel')?.name).toBe('Aus eigener Erfahrung');
    expect(vorlage('stunden')?.name).toBe('Zwei Stunden am Tag');
    expect(vorlage('gibt-es-nicht')).toBeUndefined();
  });

  it('laesst die neutrale Startsequenz fuer andere Nutzer unveraendert', () => {
    expect(STARTER_SEQUENCE).toHaveLength(3);
    expect(STARTER_SEQUENCE[0]!.body).toContain('[Ihr Nutzen in einem Satz]');
  });
});

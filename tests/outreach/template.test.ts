import { describe, it, expect } from 'vitest';
import { renderTemplate, renderStep, varsFor, domainOf, usedPlaceholders, isEmail } from '@/lib/outreach/template';

const anna = {
  email: 'anna@musterfirma.de',
  first_name: 'Anna',
  last_name: 'Beispiel',
  company: 'Musterfirma GmbH',
  website: 'https://www.musterfirma.de/kontakt',
  anlass: 'Website ohne Terminbuchung',
  custom: { branche: 'Dachdecker' },
};

describe('domainOf', () => {
  it('entfernt Protokoll, www und Pfad', () => {
    expect(domainOf('https://www.musterfirma.de/kontakt')).toBe('musterfirma.de');
    expect(domainOf('musterfirma.de')).toBe('musterfirma.de');
    expect(domainOf('')).toBe('');
  });

  it('faellt bei kaputten URLs auf den Rohwert zurueck', () => {
    expect(domainOf('http://ein fehler/pfad')).toBe('ein fehler');
  });
});

describe('renderTemplate', () => {
  const vars = varsFor(anna, { from_name: 'Max Muster' });

  it('setzt deutsche und englische Feldnamen', () => {
    expect(renderTemplate('Hallo {{vorname}} von {{firma}}', vars).text).toBe('Hallo Anna von Musterfirma GmbH');
    expect(renderTemplate('{{first_name}} {{company}}', vars).text).toBe('Anna Musterfirma GmbH');
  });

  it('nutzt freie CSV-Spalten als Platzhalter', () => {
    expect(renderTemplate('Branche: {{branche}}', vars).text).toBe('Branche: Dachdecker');
  });

  it('greift auf den Ersatzwert zurueck, wenn das Feld leer ist', () => {
    const ohneName = varsFor({ ...anna, first_name: null });
    const r = renderTemplate('Hallo {{vorname|zusammen}},', ohneName);
    expect(r.text).toBe('Hallo zusammen,');
    expect(r.missing).toEqual([]);
  });

  it('meldet leere Felder ohne Ersatzwert als fehlend', () => {
    const ohneName = varsFor({ ...anna, first_name: null });
    const r = renderTemplate('Hallo {{vorname}},', ohneName);
    expect(r.missing).toEqual(['vorname']);
  });

  it('meldet jeden fehlenden Platzhalter nur einmal', () => {
    const leer = varsFor({ email: 'x@y.de' });
    expect(renderTemplate('{{firma}} — {{firma}}', leer).missing).toEqual(['firma']);
  });

  it('vertraegt Leerzeichen in den Klammern', () => {
    expect(renderTemplate('{{ vorname }}', vars).text).toBe('Anna');
  });
});

describe('usedPlaceholders', () => {
  it('listet jeden benutzten Platzhalter einmal', () => {
    expect(usedPlaceholders('{{vorname}} {{firma}} {{vorname}}')).toEqual(['vorname', 'firma']);
  });
});

describe('renderStep', () => {
  const step1 = { step_no: 1, subject: 'Frage zu {{firma}}', body: 'Hallo {{vorname}},\n\nkurze Frage.' };

  it('rendert Betreff, Text und haengt die Signatur an', () => {
    const r = renderStep(step1, anna, { from_name: 'Max', signature: 'Viele Grüße\n{{absender}}' });
    expect(r.subject).toBe('Frage zu Musterfirma GmbH');
    expect(r.body).toBe('Hallo Anna,\n\nkurze Frage.\n\nViele Grüße\nMax');
    expect(r.missing).toEqual([]);
  });

  it('haengt Folgeschritte ohne Betreff an den bestehenden Verlauf', () => {
    const r = renderStep({ step_no: 2, subject: '', body: 'Ich hake kurz nach.' }, anna, {}, 'Frage zu Musterfirma GmbH');
    expect(r.subject).toBe('Re: Frage zu Musterfirma GmbH');
  });

  it('verdoppelt das Re: nicht', () => {
    const r = renderStep({ step_no: 3, subject: '', body: 'Letzte Mail.' }, anna, {}, 'Re: Frage zu Musterfirma GmbH');
    expect(r.subject).toBe('Re: Frage zu Musterfirma GmbH');
  });

  it('gibt fehlende Platzhalter aus Betreff und Text zusammen zurueck', () => {
    const r = renderStep({ step_no: 1, subject: '{{firma}}', body: 'Hallo {{vorname}}' }, { email: 'x@y.de' });
    expect(r.missing.sort()).toEqual(['firma', 'vorname']);
  });
});

describe('isEmail', () => {
  it('akzeptiert normale Adressen', () => {
    expect(isEmail('anna@musterfirma.de')).toBe(true);
  });

  it('lehnt Unfug ab', () => {
    for (const bad of ['', 'anna', 'anna@', '@firma.de', 'anna@firma', 'a@b.de,c@d.de', null, undefined]) {
      expect(isEmail(bad as string)).toBe(false);
    }
  });
});

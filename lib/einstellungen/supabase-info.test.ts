/**
 * Testet die Auskunft über das verwendete Supabase-Projekt.
 *
 * Wichtigster Punkt: Der Service-Role-Key darf nur als „gesetzt / nicht
 * gesetzt" nach außen, niemals als Wert.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { projektRefAus, supabaseInfo } from './supabase-info';

describe('projektRefAus', () => {
  it('zieht die Referenz aus einer Supabase-URL', () => {
    expect(projektRefAus('https://abcdefghijkl.supabase.co')).toBe('abcdefghijkl');
    expect(projektRefAus('https://abcdefghijkl.supabase.co/')).toBe('abcdefghijkl');
  });

  it('nimmt bei eigener Domain den Hostnamen', () => {
    expect(projektRefAus('https://db.firma.de')).toBe('db.firma.de');
  });

  it('verschluckt sich nicht an Unsinn', () => {
    expect(projektRefAus(null)).toBeNull();
    expect(projektRefAus('')).toBeNull();
    expect(projektRefAus('kein-url')).toBeNull();
  });
});

describe('supabaseInfo', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('meldet Projekt und Bereitschaft', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijkl.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    const info = supabaseInfo();
    expect(info.projektRef).toBe('abcdefghijkl');
    expect(info.angemeldetNutzbar).toBe(true);
    expect(info.serviceRoleGesetzt).toBe(true);
  });

  it('gibt den Service-Role-Key niemals heraus', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'streng-geheimer-service-key';
    expect(JSON.stringify(supabaseInfo())).not.toContain('streng-geheimer-service-key');
  });

  it('meldet ehrlich, wenn nichts eingerichtet ist', () => {
    const info = supabaseInfo();
    expect(info.url).toBeNull();
    expect(info.angemeldetNutzbar).toBe(false);
    expect(info.serviceRoleGesetzt).toBe(false);
  });
});

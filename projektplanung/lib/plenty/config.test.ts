import { afterEach, describe, expect, it } from 'vitest';
import { getPlentyConfig } from './client';

const orig = process.env.PLENTY_BASE_URL;
afterEach(() => {
  process.env.PLENTY_BASE_URL = orig;
});

describe('getPlentyConfig – Basis-URL-Normalisierung', () => {
  it('entfernt ein angehängtes /rest/', () => {
    process.env.PLENTY_BASE_URL = 'https://p14443.my.plentysystems.com/rest/';
    expect(getPlentyConfig().baseUrl).toBe('https://p14443.my.plentysystems.com');
  });

  it('entfernt /rest ohne Slash', () => {
    process.env.PLENTY_BASE_URL = 'https://p14443.my.plentysystems.com/rest';
    expect(getPlentyConfig().baseUrl).toBe('https://p14443.my.plentysystems.com');
  });

  it('lässt eine saubere URL unverändert und trimmt Leerzeichen', () => {
    process.env.PLENTY_BASE_URL = '  https://p14443.my.plentysystems.com  ';
    expect(getPlentyConfig().baseUrl).toBe('https://p14443.my.plentysystems.com');
  });
});

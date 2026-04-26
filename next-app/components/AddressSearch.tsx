'use client';

/**
 * Debounced address search input.
 *
 * - Calls /api/geocode with a 250 ms debounce.
 * - Shows a results dropdown.
 * - Closes on outside click and on Escape.
 */

import { useEffect, useRef, useState } from 'react';
import type { AddressResult } from '@/types';

interface Props {
  onSelect(addr: AddressResult): void;
  initialQuery?: string;
}

const DEBOUNCE_MS = 250;

export default function AddressSearch({ onSelect, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      // Cancel any in-flight request — a stale response should not overwrite a fresh one.
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: ctl.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setResults(data.results ?? []);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function handleSelect(r: AddressResult) {
    setQuery(r.placeName);
    setOpen(false);
    onSelect(r);
  }

  return (
    <div className="address-search" ref={containerRef}>
      <input
        type="text"
        value={query}
        placeholder="Adresse eingeben (Straße Hausnr, PLZ Ort)"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
        spellCheck={false}
        className="address-search__input"
      />
      {loading && <span className="address-search__spinner" aria-hidden="true" />}
      {open && results.length > 0 && (
        <ul className="address-search__results" role="listbox">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="address-search__item"
              >
                {r.placeName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="address-search__error">{error}</div>}
    </div>
  );
}

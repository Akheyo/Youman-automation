'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listboxId = useId();

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
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
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleSelect(r: AddressResult) {
    setQuery(r.placeName);
    setOpen(false);
    onSelect(r);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) handleSelect(picked);
    }
  }

  return (
    <div className="address-search" ref={containerRef}>
      <label className="address-search__label" htmlFor={`${listboxId}-input`}>
        Adresse
      </label>
      <div className="address-search__inputwrap">
        <input
          id={`${listboxId}-input`}
          type="text"
          value={query}
          placeholder="Straße Hausnummer, PLZ Ort"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKey}
          autoComplete="off"
          spellCheck={false}
          className="address-search__input"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        {loading && <span className="address-search__spinner" aria-hidden="true" />}
      </div>
      {open && results.length > 0 && (
        <ul id={listboxId} className="address-search__results" role="listbox">
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`address-search__item${i === activeIndex ? ' is-active' : ''}`}
              >
                {r.placeName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="address-search__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

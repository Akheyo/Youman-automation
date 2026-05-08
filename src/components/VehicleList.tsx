import { useMemo, useState } from 'react';
import type { Vehicle } from '@/types';
import { berechneKennzahlen, berechnePortfolio, margenAmpel } from '@/lib/calculations';
import { formatEuro, formatProzent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

type Filter = 'alle' | 'im_bestand' | 'verkauft';

interface Props {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
}

export function VehicleList({ vehicles, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [search, setSearch] = useState('');

  const gefiltert = useMemo(() => {
    let list = vehicles;
    if (filter !== 'alle') list = list.filter((v) => v.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          `${v.marke} ${v.modell}`.toLowerCase().includes(q) ||
          v.kennzeichenIntern?.toLowerCase().includes(q) ||
          v.fin?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [vehicles, filter, search]);

  const portfolio = useMemo(() => berechnePortfolio(gefiltert), [gefiltert]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-1 text-sm">
          <FilterTab active={filter === 'alle'} onClick={() => setFilter('alle')}>
            Alle ({vehicles.length})
          </FilterTab>
          <FilterTab
            active={filter === 'im_bestand'}
            onClick={() => setFilter('im_bestand')}
          >
            Im Bestand ({vehicles.filter((v) => v.status === 'im_bestand').length})
          </FilterTab>
          <FilterTab active={filter === 'verkauft'} onClick={() => setFilter('verkauft')}>
            Verkauft ({vehicles.filter((v) => v.status === 'verkauft').length})
          </FilterTab>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            className="input pl-9"
            placeholder="Suche nach Marke, Modell, Kennzeichen, FIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {gefiltert.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          Keine Fahrzeuge passen zum Filter.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fahrzeug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">EK</th>
                <th className="px-4 py-3 text-right">VK</th>
                <th className="px-4 py-3 text-right">Standzeit</th>
                <th className="px-4 py-3 text-right">Gewinnanteil</th>
                <th className="px-4 py-3 text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((v) => {
                const k = berechneKennzahlen(v);
                const ampel = margenAmpel(k.margePct);
                const ampelClass =
                  ampel === 'gruen'
                    ? 'text-emerald-700 font-semibold'
                    : ampel === 'gelb'
                      ? 'text-amber-700 font-semibold'
                      : ampel === 'rot'
                        ? 'text-red-700 font-semibold'
                        : 'text-slate-400';
                return (
                  <tr
                    key={v.id}
                    onClick={() => onSelect(v.id)}
                    className={cn(
                      'border-t cursor-pointer hover:bg-slate-50',
                      v.status === 'verkauft' && 'bg-emerald-50/40',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {v.marke} {v.modell}
                      </div>
                      <div className="text-xs text-slate-500">
                        {v.kennzeichenIntern ?? v.fin ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={v.status === 'verkauft' ? 'badge-verkauft' : 'badge-bestand'}>
                        {v.status === 'verkauft' ? 'Verkauft' : 'Im Bestand'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatEuro(v.ankaufspreis)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatEuro(v.verkaufspreis)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {k.standzeitTage} T
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatEuro(k.gewinnanteil)}
                    </td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', ampelClass)}>
                      {formatProzent(k.margePct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 text-sm font-semibold">
              <tr className="border-t">
                <td className="px-4 py-3" colSpan={2}>
                  Summen ({portfolio.anzahl})
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatEuro(portfolio.summeAnkauf)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatEuro(portfolio.summeVerkauf)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatEuro(portfolio.summeGewinnanteil)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  Ø {formatProzent(portfolio.durchschnittsMargePct)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-3 py-1.5 transition-colors',
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}

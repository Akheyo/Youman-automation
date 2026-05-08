import type { VehicleKennzahlen } from '@/lib/calculations';
import { margenAmpel } from '@/lib/calculations';
import { formatEuro, formatProzent } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  kennzahlen: VehicleKennzahlen;
  ankaufspreis: number;
  verkaufspreis?: number | null;
  /** Kompakte Darstellung für Listen / Sidebar */
  compact?: boolean;
}

export function KennzahlenPanel({ kennzahlen, ankaufspreis, verkaufspreis, compact }: Props) {
  const ampel = margenAmpel(kennzahlen.margePct);
  const ampelClass =
    ampel === 'gruen'
      ? 'text-emerald-600'
      : ampel === 'gelb'
        ? 'text-amber-600'
        : ampel === 'rot'
          ? 'text-red-600'
          : 'text-slate-400';
  const verkauft = verkaufspreis != null;

  return (
    <div className={cn('card p-4 space-y-3', compact && 'text-sm')}>
      <div className="flex items-baseline justify-between border-b pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kennzahlen</h3>
        <span className="text-xs text-slate-400">§25a UStG · Differenzbesteuerung</span>
      </div>

      <Row label="Einkauf" value={formatEuro(ankaufspreis)} />
      {verkauft && <Row label="Verkauf" value={formatEuro(verkaufspreis)} />}

      {verkauft && (
        <>
          <Row label="Bruttogewinn" value={formatEuro(kennzahlen.bruttogewinn)} muted />
          <Row label="MwSt-Anteil (19 %)" value={formatEuro(kennzahlen.mwstBetrag)} muted />
          <Row
            label="Nettogewinn"
            value={formatEuro(kennzahlen.nettogewinn)}
            strong
            tooltip="Bruttogewinn ÷ 1,19 — das, was nach MwSt übrigbleibt"
          />
        </>
      )}

      <div className="border-t pt-2 space-y-1">
        <Row label="Kosten gesamt" value={formatEuro(kennzahlen.kostenSumme)} muted />
        {kennzahlen.arbeitskostenSumme > 0 && (
          <Row
            label={`Arbeit (${kennzahlen.arbeitsstundenSumme} h)`}
            value={formatEuro(kennzahlen.arbeitskostenSumme)}
            muted
          />
        )}
      </div>

      {verkauft ? (
        <div className="rounded-md bg-slate-900 text-white p-4 space-y-2 mt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-300">Gewinnanteil</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatEuro(kennzahlen.gewinnanteil)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-300">Marge auf EK</span>
            <span className={cn('text-2xl font-bold tabular-nums', ampelClass)}>
              {formatProzent(kennzahlen.margePct)}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-slate-100 p-4 space-y-1 mt-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">Gesamtaufwand</div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">
            {formatEuro(kennzahlen.gesamtaufwand)}
          </div>
          <div className="text-xs text-slate-500">
            Erst nach Verkauf wird Gewinnanteil und Marge berechnet.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  tooltip,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="flex items-baseline justify-between" title={tooltip}>
      <span className={cn('text-sm', muted ? 'text-slate-500' : 'text-slate-700')}>{label}</span>
      <span
        className={cn(
          'tabular-nums',
          strong ? 'text-base font-semibold' : muted ? 'text-sm text-slate-500' : 'text-sm',
        )}
      >
        {value}
      </span>
    </div>
  );
}

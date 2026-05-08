import type { VehicleKennzahlen } from '@/lib/calculations';
import { margenAmpel } from '@/lib/calculations';
import { KOSTEN_KATEGORIEN } from '@/types';
import { formatEuro, formatProzent } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  kennzahlen: VehicleKennzahlen;
  ankaufspreis: number;
  verkaufspreis?: number | null;
  /** Stundensatz für die Anzeige des Arbeitskosten-Labels */
  stundensatz?: number;
  /** MwSt-Satz, default 19 % */
  mwstSatz?: number;
}

/**
 * Anzeige aller Werte aus dem ursprünglichen Excel-Sheet:
 * EK, VK, Bruttogewinn, MwSt-Faktor 1,19, MwSt-Betrag, Nettogewinn,
 * Kostenpositionen (alle Kategorien einzeln), Arbeitsstunden,
 * Gewinnanteil in € und % (Marge).
 */
export function KennzahlenPanel({
  kennzahlen,
  ankaufspreis,
  verkaufspreis,
  stundensatz,
  mwstSatz = 0.19,
}: Props) {
  const ampel = margenAmpel(kennzahlen.margePct);
  const ampelClass =
    ampel === 'gruen'
      ? 'text-emerald-400'
      : ampel === 'gelb'
        ? 'text-amber-400'
        : ampel === 'rot'
          ? 'text-red-400'
          : 'text-slate-400';
  const verkauft = verkaufspreis != null;
  const steuerFaktorLabel = `${Math.round((1 + mwstSatz) * 100)} %`;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between border-b pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kalkulation</h3>
        <span className="text-xs text-slate-400">§25a UStG</span>
      </div>

      {/* Block 1: Preise */}
      <Section title="Preise">
        <Row label="Ankaufpreis" value={formatEuro(ankaufspreis)} />
        <Row
          label="Verkaufpreis"
          value={verkauft ? formatEuro(verkaufspreis) : '— noch im Bestand —'}
          muted={!verkauft}
        />
      </Section>

      {/* Block 2: Differenzbesteuerung */}
      {verkauft && (
        <Section title="Differenzbesteuerung">
          <Row label="Bruttogewinn (VK − EK)" value={formatEuro(kennzahlen.bruttogewinn)} />
          <Row
            label="Steuer-Faktor"
            value={steuerFaktorLabel}
            muted
            tooltip="Bruttogewinn ÷ 1,19 = Nettogewinn (§25a UStG)"
          />
          <Row
            label="MwSt-Anteil (abgezogen)"
            value={kennzahlen.mwstBetrag != null ? `− ${formatEuro(kennzahlen.mwstBetrag)}` : '—'}
            muted
          />
          <Row label="Nettogewinn" value={formatEuro(kennzahlen.nettogewinn)} strong />
        </Section>
      )}

      {/* Block 3: Kosten — alle Kategorien immer sichtbar */}
      <Section
        title="Kosten"
        right={<span className="tabular-nums">{formatEuro(kennzahlen.kostenSumme)}</span>}
      >
        {KOSTEN_KATEGORIEN.map((kat) => {
          const betrag = kennzahlen.kostenNachKategorie[kat.value];
          return (
            <Row
              key={kat.value}
              label={kat.label}
              value={betrag > 0 ? `− ${formatEuro(betrag)}` : '—'}
              muted={betrag === 0}
            />
          );
        })}
      </Section>

      {/* Block 4: Arbeitsstunden */}
      <Section
        title="Arbeitsstunden"
        right={<span className="tabular-nums">{formatEuro(kennzahlen.arbeitskostenSumme)}</span>}
      >
        <Row
          label={
            kennzahlen.arbeitsstundenSumme > 0
              ? `${kennzahlen.arbeitsstundenSumme} h${stundensatz != null ? ` × ${formatEuro(stundensatz)}/h` : ''}`
              : 'Keine Stunden erfasst'
          }
          value={
            kennzahlen.arbeitskostenSumme > 0 ? `− ${formatEuro(kennzahlen.arbeitskostenSumme)}` : '—'
          }
          muted={kennzahlen.arbeitskostenSumme === 0}
        />
      </Section>

      {/* Block 5: Ergebnis */}
      {verkauft ? (
        <div className="rounded-md bg-slate-900 text-white p-4 space-y-3 mt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-300">Gewinnanteil</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatEuro(kennzahlen.gewinnanteil)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-700 pt-3">
            <span className="text-xs uppercase tracking-wide text-slate-300">Marge auf EK</span>
            <span className={cn('text-2xl font-bold tabular-nums', ampelClass)}>
              {formatProzent(kennzahlen.margePct)}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-slate-100 p-4 space-y-1 mt-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">Gesamtaufwand bisher</div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">
            {formatEuro(kennzahlen.gesamtaufwand)}
          </div>
          <div className="text-xs text-slate-500">
            Erst nach erfasstem Verkauf werden Gewinnanteil und Marge berechnet.
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 pt-2 border-t first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        {right && <span className="text-sm font-semibold tabular-nums">{right}</span>}
      </div>
      <div className="space-y-0.5">{children}</div>
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
      <span className={cn('text-sm', muted ? 'text-slate-400' : 'text-slate-700')}>{label}</span>
      <span
        className={cn(
          'tabular-nums',
          strong ? 'text-base font-semibold' : muted ? 'text-sm text-slate-400' : 'text-sm',
        )}
      >
        {value}
      </span>
    </div>
  );
}

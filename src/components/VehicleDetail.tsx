import { useMemo } from 'react';
import type { Vehicle } from '@/types';
import { KOSTEN_KATEGORIEN } from '@/types';
import { berechneKennzahlen } from '@/lib/calculations';
import { formatDatum, formatEuro, formatZahl } from '@/lib/format';
import { KennzahlenPanel } from './KennzahlenPanel';
import { ArrowLeft, Copy, Edit, Tag, Trash2 } from 'lucide-react';

interface Props {
  vehicle: Vehicle;
  onBack: () => void;
  onEdit: () => void;
  onSell: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function VehicleDetail({ vehicle, onBack, onEdit, onSell, onDuplicate, onDelete }: Props) {
  const kennzahlen = useMemo(() => berechneKennzahlen(vehicle), [vehicle]);
  const kategorieLabel = useMemo(
    () => Object.fromEntries(KOSTEN_KATEGORIEN.map((k) => [k.value, k.label])),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Zurück zur Übersicht
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {vehicle.status === 'im_bestand' && (
            <button className="btn-success" onClick={onSell}>
              <Tag size={16} /> Verkauf erfassen
            </button>
          )}
          <button className="btn-secondary" onClick={onEdit}>
            <Edit size={16} /> Bearbeiten
          </button>
          <button className="btn-secondary" onClick={onDuplicate}>
            <Copy size={16} /> Duplizieren
          </button>
          <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 size={16} /> Löschen
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Header Card */}
          <section className="card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">
                  {vehicle.marke} {vehicle.modell}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {vehicle.kennzeichenIntern && `${vehicle.kennzeichenIntern} · `}
                  {vehicle.erstzulassung && `EZ ${formatDatum(vehicle.erstzulassung)} · `}
                  {vehicle.km != null && `${formatZahl(vehicle.km).replace(',00', '')} km`}
                </p>
              </div>
              <span className={vehicle.status === 'verkauft' ? 'badge-verkauft' : 'badge-bestand'}>
                {vehicle.status === 'verkauft' ? 'Verkauft' : 'Im Bestand'}
              </span>
            </div>
            {vehicle.fin && (
              <div className="text-xs text-slate-500 font-mono">FIN: {vehicle.fin}</div>
            )}
            {vehicle.notizen && (
              <div className="rounded-md bg-slate-50 border p-3 text-sm whitespace-pre-wrap">
                {vehicle.notizen}
              </div>
            )}
          </section>

          {/* Einkauf / Verkauf */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5 space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Einkauf</div>
              <div className="text-2xl font-bold tabular-nums">
                {formatEuro(vehicle.ankaufspreis)}
              </div>
              <div className="text-sm text-slate-500">am {formatDatum(vehicle.ankaufsdatum)}</div>
            </div>
            <div className="card p-5 space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Verkauf</div>
              <div className="text-2xl font-bold tabular-nums">
                {vehicle.verkaufspreis != null ? formatEuro(vehicle.verkaufspreis) : '—'}
              </div>
              <div className="text-sm text-slate-500">
                {vehicle.verkaufsdatum
                  ? `am ${formatDatum(vehicle.verkaufsdatum)}`
                  : `Standzeit ${kennzahlen.standzeitTage} Tage`}
                {vehicle.kaeufer ? ` · ${vehicle.kaeufer}` : ''}
              </div>
            </div>
          </section>

          {/* Kosten */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Kosten ({vehicle.kosten.length})
              </h3>
              <span className="text-sm font-semibold tabular-nums">
                {formatEuro(kennzahlen.kostenSumme)}
              </span>
            </div>
            {vehicle.kosten.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Keine Kostenpositionen erfasst.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Kategorie</th>
                      <th className="px-2 py-2">Bezeichnung</th>
                      <th className="px-2 py-2">Datum</th>
                      <th className="px-2 py-2 text-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.kosten.map((k) => (
                      <tr key={k.id} className="border-t">
                        <td className="px-2 py-2">{kategorieLabel[k.kategorie]}</td>
                        <td className="px-2 py-2">{k.bezeichnung}</td>
                        <td className="px-2 py-2">{formatDatum(k.datum)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatEuro(k.betrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td colSpan={3} className="px-2 py-2 text-right">Summe</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatEuro(kennzahlen.kostenSumme)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Aufschlüsselung nach Kategorie */}
            {kennzahlen.kostenSumme > 0 && (
              <div className="grid gap-1 sm:grid-cols-2 text-xs text-slate-600 pt-2 border-t">
                {KOSTEN_KATEGORIEN.filter((k) => kennzahlen.kostenNachKategorie[k.value] > 0).map((k) => (
                  <div key={k.value} className="flex justify-between">
                    <span>{k.label}</span>
                    <span className="tabular-nums">
                      {formatEuro(kennzahlen.kostenNachKategorie[k.value])}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Arbeitsstunden */}
          {vehicle.arbeitsstunden.length > 0 && (
            <section className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Arbeitsstunden ({kennzahlen.arbeitsstundenSumme} h × {formatEuro(vehicle.stundensatz)} /h)
                </h3>
                <span className="text-sm font-semibold tabular-nums">
                  {formatEuro(kennzahlen.arbeitskostenSumme)}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Beschreibung</th>
                    <th className="px-2 py-2">Datum</th>
                    <th className="px-2 py-2 text-right">Stunden</th>
                    <th className="px-2 py-2 text-right">€</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicle.arbeitsstunden.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-2 py-2">{a.beschreibung}</td>
                      <td className="px-2 py-2">{formatDatum(a.datum)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.stunden}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatEuro(a.stunden * vehicle.stundensatz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 self-start">
          <KennzahlenPanel
            kennzahlen={kennzahlen}
            ankaufspreis={vehicle.ankaufspreis}
            verkaufspreis={vehicle.verkaufspreis}
            stundensatz={vehicle.stundensatz}
          />
        </aside>
      </div>
    </div>
  );
}

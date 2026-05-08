import { useMemo, useState } from 'react';
import type { Vehicle } from '@/types';
import { Dialog } from './Dialog';
import { MoneyInput } from './MoneyInput';
import { berechneKennzahlen } from '@/lib/calculations';
import { formatEuro, formatProzent, heuteISO } from '@/lib/format';

interface Props {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
  onConfirm: (patch: Pick<Vehicle, 'verkaufsdatum' | 'verkaufspreis' | 'kaeufer' | 'status'>) => void;
}

export function VerkaufModal({ vehicle, open, onClose, onConfirm }: Props) {
  const [datum, setDatum] = useState(vehicle.verkaufsdatum ?? heuteISO());
  const [preis, setPreis] = useState<number | null>(vehicle.verkaufspreis ?? null);
  const [kaeufer, setKaeufer] = useState(vehicle.kaeufer ?? '');

  const preview = useMemo(
    () => berechneKennzahlen({ ...vehicle, verkaufspreis: preis ?? undefined }),
    [vehicle, preis],
  );

  function handleConfirm() {
    if (!preis || preis <= 0) return;
    onConfirm({
      verkaufsdatum: datum,
      verkaufspreis: preis,
      kaeufer: kaeufer.trim() || undefined,
      status: 'verkauft',
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Verkauf erfassen: ${vehicle.marke} ${vehicle.modell}`}
      width="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn-success" onClick={handleConfirm} disabled={!preis || preis <= 0}>
            Verkauf bestätigen
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="vk-datum">Verkaufsdatum *</label>
            <input
              id="vk-datum"
              type="date"
              className="input"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="vk-preis">Verkaufspreis *</label>
            <MoneyInput
              id="vk-preis"
              value={preis}
              onChange={setPreis}
              placeholder="z.B. 7.500,00"
              size="lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="vk-kaeufer">Käufer (optional)</label>
            <input
              id="vk-kaeufer"
              className="input"
              value={kaeufer}
              onChange={(e) => setKaeufer(e.target.value)}
            />
          </div>
        </div>

        {preis != null && preis > 0 && (
          <div className="rounded-md bg-slate-900 text-white p-4 grid grid-cols-2 gap-3">
            <Stat label="Bruttogewinn" value={formatEuro(preview.bruttogewinn)} />
            <Stat label="Nettogewinn" value={formatEuro(preview.nettogewinn)} />
            <Stat
              label="Gewinnanteil"
              value={formatEuro(preview.gewinnanteil)}
              big
            />
            <Stat label="Marge auf EK" value={formatProzent(preview.margePct)} big />
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-300">{label}</div>
      <div className={big ? 'text-xl font-bold tabular-nums' : 'text-base tabular-nums'}>
        {value}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { Vehicle, KostenPosition, ArbeitsstundenEintrag, KostenKategorie } from '@/types';
import { KOSTEN_KATEGORIEN } from '@/types';
import { generateId } from '@/lib/storage';
import { heuteISO } from '@/lib/format';
import { MoneyInput } from './MoneyInput';
import { berechneKennzahlen } from '@/lib/calculations';
import { KennzahlenPanel } from './KennzahlenPanel';
import { Plus, Trash2 } from 'lucide-react';

type DraftVehicle = Omit<Vehicle, 'id' | 'erstelltAm' | 'geaendertAm'>;

interface Props {
  initial?: Vehicle;
  defaultStundensatz: number;
  onSubmit: (data: DraftVehicle) => void;
  onCancel: () => void;
}

export function VehicleForm({ initial, defaultStundensatz, onSubmit, onCancel }: Props) {
  const [marke, setMarke] = useState(initial?.marke ?? '');
  const [modell, setModell] = useState(initial?.modell ?? '');
  const [erstzulassung, setErstzulassung] = useState(initial?.erstzulassung ?? '');
  const [km, setKm] = useState<string>(initial?.km != null ? String(initial.km) : '');
  const [fin, setFin] = useState(initial?.fin ?? '');
  const [kennzeichenIntern, setKennzeichenIntern] = useState(initial?.kennzeichenIntern ?? '');
  const [notizen, setNotizen] = useState(initial?.notizen ?? '');

  const [ankaufsdatum, setAnkaufsdatum] = useState(initial?.ankaufsdatum ?? heuteISO());
  const [ankaufspreis, setAnkaufspreis] = useState<number | null>(initial?.ankaufspreis ?? null);
  const [stundensatz, setStundensatz] = useState<number>(initial?.stundensatz ?? defaultStundensatz);

  const [kosten, setKosten] = useState<KostenPosition[]>(initial?.kosten ?? []);
  const [arbeit, setArbeit] = useState<ArbeitsstundenEintrag[]>(initial?.arbeitsstunden ?? []);

  const [verkaufErfasst, setVerkaufErfasst] = useState(initial?.status === 'verkauft');
  const [verkaufsdatum, setVerkaufsdatum] = useState(initial?.verkaufsdatum ?? heuteISO());
  const [verkaufspreis, setVerkaufspreis] = useState<number | null>(initial?.verkaufspreis ?? null);
  const [kaeufer, setKaeufer] = useState(initial?.kaeufer ?? '');

  const [error, setError] = useState<string | null>(null);

  const draft: DraftVehicle = useMemo(
    () => ({
      marke: marke.trim(),
      modell: modell.trim(),
      erstzulassung: erstzulassung || undefined,
      km: km ? Number(km) : undefined,
      fin: fin.trim() || undefined,
      kennzeichenIntern: kennzeichenIntern.trim() || undefined,
      notizen: notizen.trim() || undefined,
      ankaufsdatum,
      ankaufspreis: ankaufspreis ?? 0,
      kosten,
      arbeitsstunden: arbeit,
      stundensatz,
      verkaufsdatum: verkaufErfasst ? verkaufsdatum : undefined,
      verkaufspreis: verkaufErfasst ? (verkaufspreis ?? undefined) : undefined,
      kaeufer: verkaufErfasst ? kaeufer.trim() || undefined : undefined,
      status: verkaufErfasst ? 'verkauft' : 'im_bestand',
    }),
    [
      marke,
      modell,
      erstzulassung,
      km,
      fin,
      kennzeichenIntern,
      notizen,
      ankaufsdatum,
      ankaufspreis,
      kosten,
      arbeit,
      stundensatz,
      verkaufErfasst,
      verkaufsdatum,
      verkaufspreis,
      kaeufer,
    ],
  );

  // Live-Berechnung als Vorschau
  const previewVehicle: Vehicle = useMemo(
    () => ({
      ...draft,
      id: initial?.id ?? 'preview',
      erstelltAm: initial?.erstelltAm ?? new Date().toISOString(),
      geaendertAm: new Date().toISOString(),
    }),
    [draft, initial?.id, initial?.erstelltAm],
  );
  const kennzahlen = useMemo(() => berechneKennzahlen(previewVehicle), [previewVehicle]);

  function addKosten() {
    setKosten((prev) => [
      ...prev,
      {
        id: generateId(),
        kategorie: 'reparatur',
        bezeichnung: '',
        betrag: 0,
        datum: heuteISO(),
      },
    ]);
  }
  function updateKosten(id: string, patch: Partial<KostenPosition>) {
    setKosten((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  }
  function removeKosten(id: string) {
    setKosten((prev) => prev.filter((k) => k.id !== id));
  }

  function addArbeit() {
    setArbeit((prev) => [
      ...prev,
      { id: generateId(), beschreibung: '', stunden: 0, datum: heuteISO() },
    ]);
  }
  function updateArbeit(id: string, patch: Partial<ArbeitsstundenEintrag>) {
    setArbeit((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeArbeit(id: string) {
    setArbeit((prev) => prev.filter((a) => a.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!draft.marke || !draft.modell) {
      setError('Marke und Modell sind Pflichtfelder.');
      return;
    }
    if (!draft.ankaufspreis || draft.ankaufspreis <= 0) {
      setError('Einkaufspreis muss größer 0 sein.');
      return;
    }
    if (verkaufErfasst && (!draft.verkaufspreis || draft.verkaufspreis <= 0)) {
      setError('Wenn als verkauft markiert: Verkaufspreis muss größer 0 sein.');
      return;
    }
    onSubmit(draft);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Stammdaten */}
        <section className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Stammdaten</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="marke">Marke *</label>
              <input
                id="marke"
                className="input"
                value={marke}
                onChange={(e) => setMarke(e.target.value)}
                placeholder="z.B. VW"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="modell">Modell *</label>
              <input
                id="modell"
                className="input"
                value={modell}
                onChange={(e) => setModell(e.target.value)}
                placeholder="z.B. Polo"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="erstzulassung">Erstzulassung</label>
              <input
                id="erstzulassung"
                type="date"
                className="input"
                value={erstzulassung}
                onChange={(e) => setErstzulassung(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="km">Kilometerstand</label>
              <input
                id="km"
                type="number"
                inputMode="numeric"
                className="input"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="z.B. 132000"
              />
            </div>
            <div>
              <label className="label" htmlFor="fin">FIN / Fahrgestellnummer</label>
              <input
                id="fin"
                className="input"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="kennzeichen">Internes Kennzeichen</label>
              <input
                id="kennzeichen"
                className="input"
                value={kennzeichenIntern}
                onChange={(e) => setKennzeichenIntern(e.target.value)}
                placeholder="z.B. POLO-001"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notizen">Notizen</label>
            <textarea
              id="notizen"
              className="input min-h-[80px]"
              value={notizen}
              onChange={(e) => setNotizen(e.target.value)}
            />
          </div>
        </section>

        {/* Einkauf — prominent */}
        <section className="card p-5 space-y-4 border-l-4 border-l-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Einkauf</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ankaufsdatum">Ankaufsdatum *</label>
              <input
                id="ankaufsdatum"
                type="date"
                className="input"
                value={ankaufsdatum}
                onChange={(e) => setAnkaufsdatum(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="ankaufspreis">Einkaufspreis (EK) *</label>
              <MoneyInput
                id="ankaufspreis"
                value={ankaufspreis}
                onChange={setAnkaufspreis}
                placeholder="z.B. 4.750,00"
                size="lg"
                required
              />
            </div>
          </div>
        </section>

        {/* Kosten */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kosten</h3>
            <button type="button" className="btn-secondary" onClick={addKosten}>
              <Plus size={16} /> Position hinzufügen
            </button>
          </div>
          {kosten.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Keine Kostenpositionen erfasst.</p>
          ) : (
            <div className="space-y-2">
              {kosten.map((k) => (
                <div key={k.id} className="grid gap-2 sm:grid-cols-[160px_1fr_140px_140px_auto] items-center">
                  <select
                    className="input"
                    value={k.kategorie}
                    onChange={(e) =>
                      updateKosten(k.id, { kategorie: e.target.value as KostenKategorie })
                    }
                  >
                    {KOSTEN_KATEGORIEN.map((kat) => (
                      <option key={kat.value} value={kat.value}>
                        {kat.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Bezeichnung, z.B. Radio neu"
                    value={k.bezeichnung}
                    onChange={(e) => updateKosten(k.id, { bezeichnung: e.target.value })}
                  />
                  <MoneyInput
                    value={k.betrag}
                    onChange={(v) => updateKosten(k.id, { betrag: v ?? 0 })}
                  />
                  <input
                    type="date"
                    className="input"
                    value={k.datum}
                    onChange={(e) => updateKosten(k.id, { datum: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-ghost text-red-600 hover:bg-red-50"
                    onClick={() => removeKosten(k.id)}
                    aria-label="Position löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Arbeitsstunden */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Arbeitsstunden
            </h3>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">
                Stundensatz:{' '}
                <input
                  type="number"
                  className="input w-24 inline-block ml-1"
                  value={stundensatz}
                  min={0}
                  step={1}
                  onChange={(e) => setStundensatz(Number(e.target.value) || 0)}
                />
                <span className="ml-1">€/h</span>
              </label>
              <button type="button" className="btn-secondary" onClick={addArbeit}>
                <Plus size={16} /> Stunden hinzufügen
              </button>
            </div>
          </div>
          {arbeit.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Keine Arbeitsstunden erfasst.</p>
          ) : (
            <div className="space-y-2">
              {arbeit.map((a) => (
                <div key={a.id} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto] items-center">
                  <input
                    className="input"
                    placeholder="Beschreibung"
                    value={a.beschreibung}
                    onChange={(e) => updateArbeit(a.id, { beschreibung: e.target.value })}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    className="input text-right tabular-nums"
                    placeholder="Std"
                    step="0.25"
                    value={a.stunden}
                    onChange={(e) => updateArbeit(a.id, { stunden: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="date"
                    className="input"
                    value={a.datum}
                    onChange={(e) => updateArbeit(a.id, { datum: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-ghost text-red-600 hover:bg-red-50"
                    onClick={() => removeArbeit(a.id)}
                    aria-label="Eintrag löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Verkauf */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Verkauf</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={verkaufErfasst}
                onChange={(e) => setVerkaufErfasst(e.target.checked)}
                className="h-4 w-4"
              />
              Verkauft
            </label>
          </div>
          {verkaufErfasst && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="verkaufsdatum">Verkaufsdatum</label>
                <input
                  id="verkaufsdatum"
                  type="date"
                  className="input"
                  value={verkaufsdatum}
                  onChange={(e) => setVerkaufsdatum(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="verkaufspreis">Verkaufspreis (VK) *</label>
                <MoneyInput
                  id="verkaufspreis"
                  value={verkaufspreis}
                  onChange={setVerkaufspreis}
                  placeholder="z.B. 7.500,00"
                  size="lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="kaeufer">Käufer (optional)</label>
                <input
                  id="kaeufer"
                  className="input"
                  value={kaeufer}
                  onChange={(e) => setKaeufer(e.target.value)}
                />
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 sticky bottom-0 bg-slate-50/95 backdrop-blur py-3 border-t -mx-2 px-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary">
            {initial ? 'Änderungen speichern' : 'Fahrzeug anlegen'}
          </button>
        </div>
      </div>

      {/* Live-Vorschau Kennzahlen */}
      <aside className="lg:sticky lg:top-4 self-start">
        <KennzahlenPanel
          kennzahlen={kennzahlen}
          ankaufspreis={draft.ankaufspreis}
          verkaufspreis={draft.verkaufspreis}
          stundensatz={draft.stundensatz}
        />
      </aside>
    </form>
  );
}

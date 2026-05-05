/**
 * Global app state — Zustand.
 *
 * Single store, shallow updates only. Selectors live in components for
 * granular re-renders.
 */

import { create } from 'zustand';
import type { AddressResult, BuildingFootprint, NrwRoofSegment, PVCalculation, Consumption } from '@/types';
import type { PanelLayout } from '@/types';
import type { Aspect, RoofType } from './roof-geometry';

export type Step = 'address' | 'roof' | 'configure' | 'lead';

export interface ManualRoofState {
  /** Aktiv: zeigt ManualRoofPanel + RoofTracer statt NRW-Solarkataster. */
  enabled: boolean;
  firstLengthM: number;
  houseWidthM: number;
  pitchDeg: number;
  panelWattPeak: number;
  panelAreaM2: number;
  roofType: RoofType;
  aspectA: Aspect;
  aspectB: Aspect;
  aspectC?: Aspect;
  aspectD?: Aspect;
}

interface AppState {
  step: Step;
  setStep: (step: Step) => void;
  /** Move to next step. */
  nextStep: () => void;
  /** Move to previous step. */
  prevStep: () => void;

  address: AddressResult | null;
  setAddress: (a: AddressResult | null) => void;

  building: BuildingFootprint | null;
  setBuilding: (b: BuildingFootprint | null) => void;

  /** All segments returned by NRW WFS for this building. */
  segments: NrwRoofSegment[];
  setSegments: (s: NrwRoofSegment[]) => void;

  /** Set of segment ids currently activated for module placement. */
  activeSegmentIds: Set<string>;
  toggleSegment: (id: string) => void;
  fillAllSuitable: () => void;
  clearSegments: () => void;

  /** Combined panel layout from all active segments. */
  layout: PanelLayout | null;
  setLayout: (l: PanelLayout | null) => void;

  /** Per-segment panel layouts (so we can rebuild the combined one). */
  layoutsBySegment: Record<string, PanelLayout>;
  setLayoutForSegment: (id: string, l: PanelLayout | null) => void;

  /** Yearly yield from PVGIS for the current selection (kWh). */
  yearlyYieldKwh: number;
  setYearlyYieldKwh: (kwh: number) => void;

  consumption: Consumption;
  setConsumption: (patch: Partial<Consumption>) => void;
  setAddon: (key: keyof Consumption['addons'], value: boolean) => void;

  result: PVCalculation | null;
  setResult: (r: PVCalculation | null) => void;

  /** Generic loading flags + last error message for the current step. */
  loading: {
    geocode: boolean;
    building: boolean;
    nrw: boolean;
    pvgis: boolean;
    lead: boolean;
  };
  setLoading: (key: keyof AppState['loading'], value: boolean) => void;

  errorBanner: { title: string; action?: string; detail?: string } | null;
  setError: (e: AppState['errorBanner']) => void;

  /** Manuelle Dach-Geometrie (1:1 nach A&B-Excel-Sheet). */
  manualRoof: ManualRoofState;
  setManualRoof: (patch: Partial<ManualRoofState>) => void;
  /** Aktiviert Manual-Mode (Tracer + Excel-Formeln) statt NRW-WFS. */
  enableManualRoof: (enabled: boolean) => void;
}

const STEP_ORDER: Step[] = ['address', 'roof', 'configure', 'lead'];

const DEFAULT_KWH = parseInt(process.env['NEXT_PUBLIC_DEFAULT_KWH_YEAR'] ?? '4500', 10) || 4500;
const DEFAULT_PRICE = parseInt(process.env['NEXT_PUBLIC_DEFAULT_PRICE_CT_KWH'] ?? '35', 10) || 35;

export const useApp = create<AppState>((set, get) => ({
  step: 'address',
  setStep: (step) => set({ step }),
  nextStep: () => {
    const idx = STEP_ORDER.indexOf(get().step);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) {
      const nextIndex = idx + 1;
      const nextStep = STEP_ORDER[nextIndex];
      if (nextStep) set({ step: nextStep });
    }
  },
  prevStep: () => {
    const idx = STEP_ORDER.indexOf(get().step);
    if (idx > 0) {
      const prevIndex = idx - 1;
      const prevStep = STEP_ORDER[prevIndex];
      if (prevStep) set({ step: prevStep });
    }
  },

  address: null,
  setAddress: (a) => set({ address: a }),

  building: null,
  setBuilding: (b) => set({ building: b }),

  segments: [],
  setSegments: (s) => set({ segments: s }),

  activeSegmentIds: new Set(),
  toggleSegment: (id) =>
    set((state) => {
      const next = new Set(state.activeSegmentIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { activeSegmentIds: next };
    }),
  fillAllSuitable: () =>
    set((state) => {
      const next = new Set(
        state.segments.filter((s) => s.suitability === 'sehr gut' || s.suitability === 'gut').map((s) => s.id),
      );
      return { activeSegmentIds: next };
    }),
  clearSegments: () => set({ activeSegmentIds: new Set(), layoutsBySegment: {}, layout: null }),

  layout: null,
  setLayout: (l) => set({ layout: l }),

  layoutsBySegment: {},
  setLayoutForSegment: (id, l) =>
    set((state) => {
      const next = { ...state.layoutsBySegment };
      if (l) next[id] = l;
      else delete next[id];
      return { layoutsBySegment: next };
    }),

  yearlyYieldKwh: 0,
  setYearlyYieldKwh: (kwh) => set({ yearlyYieldKwh: kwh }),

  consumption: {
    kwhYear: DEFAULT_KWH,
    priceCtKwh: DEFAULT_PRICE,
    hasEAuto: false,
    addons: { storage: false, wallbox: false, heatpump: false },
  },
  setConsumption: (patch) =>
    set((state) => ({
      consumption: { ...state.consumption, ...patch },
    })),
  setAddon: (key, value) =>
    set((state) => ({
      consumption: { ...state.consumption, addons: { ...state.consumption.addons, [key]: value } },
    })),

  result: null,
  setResult: (r) => set({ result: r }),

  loading: { geocode: false, building: false, nrw: false, pvgis: false, lead: false },
  setLoading: (key, value) =>
    set((state) => ({ loading: { ...state.loading, [key]: value } })),

  errorBanner: null,
  setError: (e) => set({ errorBanner: e }),

  manualRoof: {
    enabled: false,
    firstLengthM: 10,
    houseWidthM: 10,
    pitchDeg: 40,
    panelWattPeak: 450,
    panelAreaM2: 2,
    roofType: 'satteldach',
    aspectA: 'ost',
    aspectB: 'west',
  },
  setManualRoof: (patch) =>
    set((state) => ({ manualRoof: { ...state.manualRoof, ...patch } })),
  enableManualRoof: (enabled) =>
    set((state) => ({ manualRoof: { ...state.manualRoof, enabled } })),
}));

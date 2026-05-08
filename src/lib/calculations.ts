import type { Vehicle, KostenPosition, KostenKategorie } from '@/types';

export const DEFAULT_MWST_SATZ = 0.19;

export interface VehicleKennzahlen {
  /** Summe aller Kostenpositionen in € */
  kostenSumme: number;
  /** Summe Kosten gruppiert nach Kategorie */
  kostenNachKategorie: Record<KostenKategorie, number>;
  /** Summe der erfassten Stunden */
  arbeitsstundenSumme: number;
  /** Arbeitsstunden umgerechnet in € (stunden * stundensatz) */
  arbeitskostenSumme: number;
  /** Gesamtaufwand inkl. EK + Kosten + Arbeit (für Liquiditätsbetrachtung) */
  gesamtaufwand: number;
  /** Standzeit in Tagen (vom Ankauf bis heute oder bis Verkauf) */
  standzeitTage: number;

  // Felder, die nur bei verkauften Fahrzeugen Sinn ergeben:
  /** verkaufspreis - ankaufspreis (vor MwSt-Herausrechnung) */
  bruttogewinn: number | null;
  /** MwSt aus dem Bruttogewinn (Differenzbesteuerung §25a UStG) */
  mwstBetrag: number | null;
  /** Bruttogewinn ohne MwSt — bleibt dem Händler */
  nettogewinn: number | null;
  /** Nettogewinn − Kosten − Arbeitskosten = das, was wirklich übrigbleibt */
  gewinnanteil: number | null;
  /** Marge in % bezogen auf den Einkaufspreis */
  margePct: number | null;
}

const NULL_KOSTEN: Record<KostenKategorie, number> = {
  transport: 0,
  reparatur: 0,
  service: 0,
  ersatzteil: 0,
  aufbereitung: 0,
  anzeige: 0,
  gebuehren: 0,
  sonstiges: 0,
};

export function summeKosten(kosten: KostenPosition[]): number {
  return kosten.reduce((acc, k) => acc + (Number.isFinite(k.betrag) ? k.betrag : 0), 0);
}

export function kostenNachKategorie(kosten: KostenPosition[]): Record<KostenKategorie, number> {
  const acc: Record<KostenKategorie, number> = { ...NULL_KOSTEN };
  for (const k of kosten) {
    if (Number.isFinite(k.betrag)) acc[k.kategorie] += k.betrag;
  }
  return acc;
}

function tageZwischen(vonISO: string, bisISO: string): number {
  const von = new Date(vonISO).getTime();
  const bis = new Date(bisISO).getTime();
  if (!Number.isFinite(von) || !Number.isFinite(bis)) return 0;
  const ms = bis - von;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function berechneKennzahlen(
  vehicle: Vehicle,
  options: { mwstSatz?: number; heute?: Date } = {},
): VehicleKennzahlen {
  const mwstSatz = options.mwstSatz ?? DEFAULT_MWST_SATZ;
  const heute = options.heute ?? new Date();

  const kostenSum = summeKosten(vehicle.kosten);
  const kostenKat = kostenNachKategorie(vehicle.kosten);
  const stunden = vehicle.arbeitsstunden.reduce(
    (acc, a) => acc + (Number.isFinite(a.stunden) ? a.stunden : 0),
    0,
  );
  const arbeitskosten = stunden * (vehicle.stundensatz || 0);
  const gesamtaufwand = vehicle.ankaufspreis + kostenSum + arbeitskosten;

  const bisISO =
    vehicle.status === 'verkauft' && vehicle.verkaufsdatum
      ? vehicle.verkaufsdatum
      : heute.toISOString();
  const standzeit = tageZwischen(vehicle.ankaufsdatum, bisISO);

  // Verkauf-abhängige Kennzahlen
  let bruttogewinn: number | null = null;
  let mwstBetrag: number | null = null;
  let nettogewinn: number | null = null;
  let gewinnanteil: number | null = null;
  let margePct: number | null = null;

  if (vehicle.verkaufspreis != null && Number.isFinite(vehicle.verkaufspreis)) {
    bruttogewinn = vehicle.verkaufspreis - vehicle.ankaufspreis;
    nettogewinn = bruttogewinn / (1 + mwstSatz);
    mwstBetrag = bruttogewinn - nettogewinn;
    gewinnanteil = nettogewinn - kostenSum - arbeitskosten;
    margePct = vehicle.ankaufspreis > 0 ? (gewinnanteil / vehicle.ankaufspreis) * 100 : null;
  }

  return {
    kostenSumme: kostenSum,
    kostenNachKategorie: kostenKat,
    arbeitsstundenSumme: stunden,
    arbeitskostenSumme: arbeitskosten,
    gesamtaufwand,
    standzeitTage: standzeit,
    bruttogewinn,
    mwstBetrag,
    nettogewinn,
    gewinnanteil,
    margePct,
  };
}

export function margenAmpel(margePct: number | null): 'gruen' | 'gelb' | 'rot' | 'neutral' {
  if (margePct == null) return 'neutral';
  if (margePct >= 20) return 'gruen';
  if (margePct >= 10) return 'gelb';
  return 'rot';
}

/**
 * Aggregiert Kennzahlen über eine Liste von Fahrzeugen für die Übersicht.
 */
export interface PortfolioKennzahlen {
  anzahl: number;
  anzahlImBestand: number;
  anzahlVerkauft: number;
  summeAnkauf: number;
  summeVerkauf: number;
  summeGewinnanteil: number;
  durchschnittsMargePct: number | null;
}

export function berechnePortfolio(vehicles: Vehicle[]): PortfolioKennzahlen {
  let summeAnkauf = 0;
  let summeVerkauf = 0;
  let summeGewinnanteil = 0;
  let margenSumme = 0;
  let margenCount = 0;
  let imBestand = 0;
  let verkauft = 0;

  for (const v of vehicles) {
    summeAnkauf += v.ankaufspreis;
    if (v.status === 'verkauft') verkauft++;
    else imBestand++;
    if (v.verkaufspreis != null) {
      summeVerkauf += v.verkaufspreis;
      const k = berechneKennzahlen(v);
      if (k.gewinnanteil != null) summeGewinnanteil += k.gewinnanteil;
      if (k.margePct != null) {
        margenSumme += k.margePct;
        margenCount++;
      }
    }
  }

  return {
    anzahl: vehicles.length,
    anzahlImBestand: imBestand,
    anzahlVerkauft: verkauft,
    summeAnkauf,
    summeVerkauf,
    summeGewinnanteil,
    durchschnittsMargePct: margenCount > 0 ? margenSumme / margenCount : null,
  };
}

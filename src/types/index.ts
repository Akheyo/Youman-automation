export type KostenKategorie =
  | 'transport'
  | 'reparatur'
  | 'service'
  | 'ersatzteil'
  | 'aufbereitung'
  | 'anzeige'
  | 'gebuehren'
  | 'sonstiges';

export const KOSTEN_KATEGORIEN: { value: KostenKategorie; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'reparatur', label: 'Reparatur' },
  { value: 'service', label: 'Service / TÜV' },
  { value: 'ersatzteil', label: 'Ersatzteil' },
  { value: 'aufbereitung', label: 'Aufbereitung' },
  { value: 'anzeige', label: 'Anzeige / Inserat' },
  { value: 'gebuehren', label: 'Gebühren' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export interface KostenPosition {
  id: string;
  kategorie: KostenKategorie;
  bezeichnung: string;
  betrag: number;
  datum: string;
}

export interface ArbeitsstundenEintrag {
  id: string;
  beschreibung: string;
  stunden: number;
  datum: string;
}

export type FahrzeugStatus = 'im_bestand' | 'verkauft';

export interface Vehicle {
  id: string;
  marke: string;
  modell: string;
  erstzulassung?: string;
  km?: number;
  fin?: string;
  kennzeichenIntern?: string;
  notizen?: string;

  ankaufsdatum: string;
  ankaufspreis: number;

  kosten: KostenPosition[];

  arbeitsstunden: ArbeitsstundenEintrag[];
  stundensatz: number;

  verkaufsdatum?: string;
  verkaufspreis?: number;
  kaeufer?: string;

  status: FahrzeugStatus;
  erstelltAm: string;
  geaendertAm: string;
}

export interface Settings {
  defaultStundensatz: number;
  mwstSatz: number;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultStundensatz: 50,
  mwstSatz: 0.19,
};

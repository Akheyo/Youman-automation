/**
 * Roof geometry calculator — 1:1 Portierung der A&B-Excel-Formeln.
 *
 * Eingaben (aus dem Sheet "Inputs"):
 *   Länge First (m), Breite Haus (m), Winkel C (°), Winkel B (°),
 *   Winkel A (°), Wp pro Modul, Modul-Fläche (m²).
 *
 * Berechnungen (Sheet 1):
 *   1.  Hypotenuse / Ortgang C  = (Breite / 2) · sin(C) / sin(A)
 *       Bei rechtem Winkel oben (C = 90°) reduziert sich das zu
 *           C = (Breite / 2) / sin(A)           (= (Breite/2) / cos(B))
 *
 *   2.  Dachfläche pro Seite   = C · First-Länge
 *
 *   3.  Modulanzahl pro Seite  = floor(Dachfläche / Modul-m²)
 *
 *   4.  kWp pro Seite          = Module · Wp / 1000
 *
 *   5.  Gesamt kWp             = Σ kWp pro Seite
 *
 * Validiert mit dem Beispiel aus der Excel:
 *   Breite=10, First=10, B=40°, C=90°, A=50°, Wp=450, Modul-m²=2
 *     → C ≈ 6.53 m, Dachfläche ≈ 65.27 m², Module=32, kWp=14.4 / Seite,
 *       Gesamt-kWp = 28.8 (bei 2 Seiten Satteldach)
 */

export type RoofType = 'satteldach' | 'walmdach' | 'pultdach';

export type Aspect = 'sued' | 'ost' | 'west' | 'nord';

/** Ausrichtung eines Dach-Paares (Satteldach: First-Achse). */
export interface RoofOrientation {
  /** Ausrichtung der Seite A (= eine der beiden Hauptseiten). */
  sideA: Aspect;
  /** Ausrichtung der Seite B (= die gegenüberliegende Hauptseite). */
  sideB: Aspect;
  /**
   * Beim Walmdach gibt es zusätzlich Seite C (eine der beiden Walmen) und
   * Seite D (die gegenüberliegende). Optional.
   */
  sideC?: Aspect;
  sideD?: Aspect;
}

export interface RoofGeometryInput {
  /** Länge des Firstes in Metern. */
  firstLengthM: number;
  /** Breite des Hauses in Metern (gemessen rechtwinklig zum First). */
  houseWidthM: number;
  /** Winkel oben am First in Grad. Default 90° (typisches Satteldach). */
  ridgeAngleDeg?: number;
  /** Dachneigung in Grad (= Winkel zwischen Hypotenuse und Hausbreite). */
  pitchDeg: number;
  /** Watt-Peak pro Modul. Default 450 (Stand 2025). */
  panelWattPeak?: number;
  /** Modul-Fläche in m². Default 2.0 (1.95 m × 1.10 m + 5 % Verschnitt). */
  panelAreaM2?: number;
  /** Dachform — Satteldach (2 Seiten), Pultdach (1 Seite), Walmdach (4 Seiten). */
  roofType?: RoofType;
}

export interface RoofSideResult {
  /** "A" / "B" / "C" / "D" entsprechend dem Sheet. */
  label: 'A' | 'B' | 'C' | 'D';
  /** Hypotenuse / Ortgang in Metern (Eaves → First). */
  hypotenuseM: number;
  /** Dachfläche in m². */
  areaM2: number;
  /** Belegbare Modulanzahl. */
  panelCount: number;
  /** kWp dieser Seite. */
  kwp: number;
}

export interface RoofGeometryResult {
  /** Inputs verbatim — für Tooltip / Debug. */
  inputs: Required<Omit<RoofGeometryInput, 'roofType'>> & { roofType: RoofType };
  /** Eine pro Seite, beim Satteldach also zwei. */
  sides: RoofSideResult[];
  /** Summe aller Seiten in kWp. */
  totalKwp: number;
  /** Summe aller Seiten in m². */
  totalAreaM2: number;
  /** Summe aller Seiten in Modulen. */
  totalPanels: number;
}

const DEFAULTS = {
  ridgeAngleDeg: 90,
  panelWattPeak: 450,
  panelAreaM2: 2.0,
  roofType: 'satteldach' as RoofType,
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Hypotenuse C (Ortgang) gemäß Sinussatz.
 *
 *   c / sin(C) = a / sin(A)
 *
 * mit
 *   a = halbe Hausbreite (Ankathete des Dachneigungswinkels B)
 *   A = 180° − B − C
 *   C = First-Winkel (default 90°)
 *
 * Beispiel: Breite=10, B=40°, C=90° → A=50° → c = 5·sin(90°)/sin(50°) = 6.527 m
 */
export function hypotenuseFromHalfWidth(
  halfWidthM: number,
  pitchDeg: number,
  ridgeAngleDeg: number = DEFAULTS.ridgeAngleDeg,
): number {
  const angleA = 180 - ridgeAngleDeg - pitchDeg;
  const sinA = Math.sin(angleA * DEG_TO_RAD);
  if (sinA <= 0) return 0;
  return (halfWidthM * Math.sin(ridgeAngleDeg * DEG_TO_RAD)) / sinA;
}

/**
 * Vollständige Dachgeometrie aus Hausmaßen.
 *
 * Liefert pro Seite Hypotenuse, Fläche, Modulanzahl und kWp — exakt nach
 * dem Excel-Sheet von A&B Solarenergy.
 */
export function computeRoofGeometry(input: RoofGeometryInput): RoofGeometryResult {
  const ridgeAngleDeg = input.ridgeAngleDeg ?? DEFAULTS.ridgeAngleDeg;
  const panelWattPeak = input.panelWattPeak ?? DEFAULTS.panelWattPeak;
  const panelAreaM2 = input.panelAreaM2 ?? DEFAULTS.panelAreaM2;
  const roofType = input.roofType ?? DEFAULTS.roofType;

  const halfWidth = input.houseWidthM / 2;
  const hypotenuse = hypotenuseFromHalfWidth(halfWidth, input.pitchDeg, ridgeAngleDeg);

  const sides: RoofSideResult[] = [];

  if (roofType === 'pultdach') {
    // Pultdach: nur eine geneigte Fläche, Hypotenuse läuft über die volle Breite.
    const fullHyp = hypotenuseFromHalfWidth(input.houseWidthM, input.pitchDeg, ridgeAngleDeg);
    const area = fullHyp * input.firstLengthM;
    sides.push(buildSide('A', fullHyp, area, panelAreaM2, panelWattPeak));
  } else if (roofType === 'satteldach') {
    // Satteldach: zwei symmetrische Hauptseiten.
    const area = hypotenuse * input.firstLengthM;
    sides.push(buildSide('A', hypotenuse, area, panelAreaM2, panelWattPeak));
    sides.push(buildSide('B', hypotenuse, area, panelAreaM2, panelWattPeak));
  } else {
    // Walmdach: zwei Hauptseiten (Trapeze) + zwei Walmen (Dreiecke).
    // Ridge ist kürzer als die First-Länge; Walm-Tiefe ≈ halbe Hausbreite (häufige
    // Faustregel beim deutschen Krüppel-/Walmdach mit 100 % Walm).
    const walmTiefe = halfWidth;
    const ridgeM = Math.max(0, input.firstLengthM - 2 * walmTiefe);
    // Trapez-Fläche = (a + c)/2 · h, mit a = first-Länge, c = ridge, h = hypotenuse.
    const trapezArea = ((input.firstLengthM + ridgeM) / 2) * hypotenuse;
    sides.push(buildSide('A', hypotenuse, trapezArea, panelAreaM2, panelWattPeak));
    sides.push(buildSide('B', hypotenuse, trapezArea, panelAreaM2, panelWattPeak));
    // Walm-Dreieck: Grundlinie = Hausbreite, Höhe = hypotenuse-äquivalent zum Walm.
    const walmHyp = hypotenuse;
    const walmArea = 0.5 * input.houseWidthM * walmHyp;
    sides.push(buildSide('C', walmHyp, walmArea, panelAreaM2, panelWattPeak));
    sides.push(buildSide('D', walmHyp, walmArea, panelAreaM2, panelWattPeak));
  }

  const totalKwp = round2(sides.reduce((sum, s) => sum + s.kwp, 0));
  const totalAreaM2 = round2(sides.reduce((sum, s) => sum + s.areaM2, 0));
  const totalPanels = sides.reduce((sum, s) => sum + s.panelCount, 0);

  return {
    inputs: {
      firstLengthM: input.firstLengthM,
      houseWidthM: input.houseWidthM,
      ridgeAngleDeg,
      pitchDeg: input.pitchDeg,
      panelWattPeak,
      panelAreaM2,
      roofType,
    },
    sides,
    totalKwp,
    totalAreaM2,
    totalPanels,
  };
}

function buildSide(
  label: RoofSideResult['label'],
  hypotenuseM: number,
  areaM2: number,
  panelAreaM2: number,
  panelWattPeak: number,
): RoofSideResult {
  const panelCount = panelAreaM2 > 0 ? Math.floor(areaM2 / panelAreaM2) : 0;
  const kwp = (panelCount * panelWattPeak) / 1000;
  return {
    label,
    hypotenuseM: round2(hypotenuseM),
    areaM2: round2(areaM2),
    panelCount,
    kwp: round2(kwp),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

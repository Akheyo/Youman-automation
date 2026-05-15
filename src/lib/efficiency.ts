/**
 * Relative PV-Effizienz einer Dachfläche in Prozent.
 *
 * 100 % = bestmögliche Konstellation für Mitteleuropa
 *         (Süd, 30° Neigung).
 *
 * Die Berechnung kombiniert zwei empirische Faktoren:
 *   - Ausrichtungsfaktor (Azimuth → Süd-Bias)
 *   - Neigungsfaktor    (Pitch  → Maximum bei ~30°)
 *
 * Werte stammen aus Faustformeln für Deutschland; bewusst kein
 * regionalisiertes Strahlungsmodell, weil die Ratio orientation/sued
 * regional praktisch konstant ist.
 */

/* Süd-Bias über alle Himmelsrichtungen. */
const ORIENTATION_FACTOR: Record<string, number> = {
  sued: 1.0,
  suedost: 0.95,
  suedwest: 0.95,
  ost: 0.85,
  west: 0.85,
  nordost: 0.7,
  nordwest: 0.7,
  nord: 0.55,
};

function orientationKey(azimuthDeg: number): string {
  const az = ((azimuthDeg % 360) + 360) % 360;
  if (az < 22.5 || az >= 337.5) return "nord";
  if (az < 67.5) return "nordost";
  if (az < 112.5) return "ost";
  if (az < 157.5) return "suedost";
  if (az < 202.5) return "sued";
  if (az < 247.5) return "suedwest";
  if (az < 292.5) return "west";
  return "nordwest";
}

/* Stützstellen für die Neigungs-Korrektur. Maximum bei 30°. */
const PITCH_STOPS: Array<[number, number]> = [
  [0, 0.88],
  [10, 0.94],
  [20, 0.98],
  [30, 1.0],
  [35, 0.99],
  [40, 0.97],
  [50, 0.92],
  [60, 0.84],
  [90, 0.7],
];

export function pitchFactor(pitchDeg: number): number {
  const p = Math.max(0, Math.min(90, pitchDeg));
  for (let i = 0; i < PITCH_STOPS.length - 1; i++) {
    const [a, fa] = PITCH_STOPS[i]!;
    const [b, fb] = PITCH_STOPS[i + 1]!;
    if (p <= b) {
      const t = (p - a) / (b - a);
      return fa + (fb - fa) * t;
    }
  }
  return PITCH_STOPS[PITCH_STOPS.length - 1]![1];
}

/** Süd 30° → 100. Süd 0° → ~88. Nord 60° → ~46. */
export function calculateEfficiency(
  azimuthDeg: number,
  pitchDeg: number,
): number {
  const oriF = ORIENTATION_FACTOR[orientationKey(azimuthDeg)]!;
  const pitchF = pitchFactor(pitchDeg);
  const best = ORIENTATION_FACTOR.sued! * pitchFactor(30);
  const value = oriF * pitchF;
  return Math.round((value / best) * 100);
}

/**
 * Konsistente Farbcodierung für Dachflächen-Overlay und Modal.
 *   ≥ 90 %  grün
 *   75–89 % gelb-grün
 *   60–74 % gelb
 *   40–59 % orange
 *   < 40 %  rot
 */
export function efficiencyColor(percent: number): string {
  if (percent >= 90) return "#22c55e";
  if (percent >= 75) return "#84cc16";
  if (percent >= 60) return "#eab308";
  if (percent >= 40) return "#f97316";
  return "#ef4444";
}

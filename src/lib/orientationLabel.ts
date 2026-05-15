/**
 * Mappt einen Azimuth-Wert in Grad auf ein menschlich lesbares Label.
 *
 * Konvention: 0° = Nord, 90° = Ost, 180° = Süd, 270° = West.
 *
 * Beispiele:
 *   orientationLabel(165) → "Süd-Ost (165°)"
 *   orientationLabel(180) → "Süd (180°)"
 *   orientationLabel(0)   → "Nord (0°)"
 */
export function orientationLabel(azimuthDeg: number): string {
  const az = ((azimuthDeg % 360) + 360) % 360;
  const deg = Math.round(az);
  if (az < 22.5 || az >= 337.5) return `Nord (${deg}°)`;
  if (az < 67.5) return `Nord-Ost (${deg}°)`;
  if (az < 112.5) return `Ost (${deg}°)`;
  if (az < 157.5) return `Süd-Ost (${deg}°)`;
  if (az < 202.5) return `Süd (${deg}°)`;
  if (az < 247.5) return `Süd-West (${deg}°)`;
  if (az < 292.5) return `West (${deg}°)`;
  return `Nord-West (${deg}°)`;
}

/** Nur der Himmelsrichtungs-Anteil, ohne Grad-Angabe. */
export function orientationShort(azimuthDeg: number): string {
  const az = ((azimuthDeg % 360) + 360) % 360;
  if (az < 22.5 || az >= 337.5) return "Nord";
  if (az < 67.5) return "Nord-Ost";
  if (az < 112.5) return "Ost";
  if (az < 157.5) return "Süd-Ost";
  if (az < 202.5) return "Süd";
  if (az < 247.5) return "Süd-West";
  if (az < 292.5) return "West";
  return "Nord-West";
}

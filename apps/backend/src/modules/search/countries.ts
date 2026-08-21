import type { Country } from "@youman/shared";

/**
 * Ersatzliste, falls das angebundene System seine Länder nicht ausgeben kann.
 *
 * Es sind genau die Länder, für die der Plenty-Connector die dortige Landes-ID
 * fest hinterlegt hat. Eine längere Liste wäre hier schädlich statt hilfreich:
 * Ein Land ohne bekannte ID lässt sich nicht anlegen, würde in der Auswahl aber
 * so aussehen, als ginge es.
 *
 * Im Normalfall kommt die Liste vom System selbst und ist deutlich länger.
 */
export const FALLBACK_COUNTRIES: Country[] = [
  { code: "DE", name: "Deutschland", externalId: "1" },
  { code: "AT", name: "Österreich", externalId: "2" },
  { code: "BE", name: "Belgien", externalId: "3" },
  { code: "CH", name: "Schweiz", externalId: "4" },
  { code: "CY", name: "Zypern", externalId: "5" },
  { code: "CZ", name: "Tschechien", externalId: "6" },
  { code: "DK", name: "Dänemark", externalId: "7" },
  { code: "ES", name: "Spanien", externalId: "8" },
  { code: "EE", name: "Estland", externalId: "9" },
  { code: "FR", name: "Frankreich", externalId: "10" },
  { code: "FI", name: "Finnland", externalId: "11" },
  { code: "GB", name: "Großbritannien", externalId: "12" },
  { code: "GR", name: "Griechenland", externalId: "13" },
  { code: "HU", name: "Ungarn", externalId: "14" },
  { code: "IT", name: "Italien", externalId: "15" },
  { code: "IE", name: "Irland", externalId: "16" },
  { code: "LU", name: "Luxemburg", externalId: "17" },
  { code: "LV", name: "Lettland", externalId: "18" },
  { code: "LT", name: "Litauen", externalId: "19" },
  { code: "MT", name: "Malta", externalId: "20" },
  { code: "NO", name: "Norwegen", externalId: "21" },
  { code: "NL", name: "Niederlande", externalId: "22" },
  { code: "PT", name: "Portugal", externalId: "23" },
  { code: "PL", name: "Polen", externalId: "24" },
  { code: "SE", name: "Schweden", externalId: "25" },
  { code: "SG", name: "Singapur", externalId: "26" },
  { code: "SK", name: "Slowakei", externalId: "27" },
  { code: "SI", name: "Slowenien", externalId: "28" },
  { code: "US", name: "USA", externalId: "29" },
  { code: "AU", name: "Australien", externalId: "30" },
].sort((a, b) => a.name.localeCompare(b.name, "de"));

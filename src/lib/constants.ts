/**
 * Globale Konstanten der Anwendung.
 *
 * MAX_MODULES_PER_FACE basiert auf der Excel-Berechnung pro Dachseite:
 *   ~65 m² nutzbare Dachfläche / 2 m² pro Modul ≈ 32 Module.
 * Das Limit gilt PRO Dachfläche, nicht für das gesamte Gebäude. Bei einem
 * Satteldach können also bis zu 2 × 32 = 64 Module platziert werden, bei
 * Walmdach/Mansarde entsprechend mehr.
 *
 * MANUAL_EDGE_MARGIN_M / MANUAL_MODULE_GAP_M sind Validierungsregeln für
 * die manuelle Modulplatzierung (Klick + Hover-Vorschau). Strenger als die
 * Auto-Fill-Einstellungen, weil der User punktgenau setzt.
 */
export const MAX_MODULES_PER_FACE = 32;
export const MANUAL_EDGE_MARGIN_M = 0.15;
export const MANUAL_MODULE_GAP_M = 0.02;

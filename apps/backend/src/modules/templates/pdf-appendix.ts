import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { Logger } from "@nestjs/common";
import type { QuoteLanguage } from "@youman/shared";

const logger = new Logger("PdfAppendix");

/**
 * Statischer AGB-Anhang: Die 4 AGB-Seiten werden 1:1 an jedes Angebots-PDF
 * gehängt. Die AGB liegen als festes Repo-Asset (configs/templates/agb-b2b.pdf)
 * und sind für alle Angebote gleich. Pfad per AGB_PDF_PATH überschreibbar.
 */
function agbPdfPath(language: QuoteLanguage): string | null {
  const file = language === "en" ? "agb-b2b-en.pdf" : "agb-b2b.pdf";
  const candidates = [
    language === "en" ? process.env["AGB_PDF_PATH_EN"] : process.env["AGB_PDF_PATH"],
    resolve(process.cwd(), `../../configs/templates/${file}`),
    resolve(process.cwd(), `configs/templates/${file}`),
    resolve(__dirname, `../../../../../configs/templates/${file}`),
    resolve(__dirname, `../../../../../../configs/templates/${file}`),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => existsSync(p)) ?? null;
}

const cache = new Map<QuoteLanguage, Buffer | null>();

/**
 * Lädt das AGB-PDF der Sprache einmalig (best-effort).
 *
 * Fehlt die englische Fassung, wird die deutsche angehängt und das protokolliert:
 * Ein Angebot ohne AGB wäre schlechter als eines mit den AGB in der falschen
 * Sprache – der Verweis im Fußtext liefe sonst ins Leere.
 */
function loadAgb(language: QuoteLanguage): Buffer | null {
  if (cache.has(language)) return cache.get(language) ?? null;
  let path = agbPdfPath(language);
  if (!path && language !== "de") {
    logger.warn(`AGB-PDF für Sprache '${language}' nicht gefunden – es werden die deutschen AGB angehängt.`);
    path = agbPdfPath("de");
  }
  if (!path) {
    logger.warn("AGB-PDF (configs/templates/agb-b2b.pdf) nicht gefunden – Angebote werden OHNE AGB-Anhang erzeugt.");
    cache.set(language, null);
    return null;
  }
  try {
    cache.set(language, readFileSync(path));
  } catch (err) {
    logger.error(`AGB-PDF konnte nicht gelesen werden: ${err instanceof Error ? err.message : err}`);
    cache.set(language, null);
  }
  return cache.get(language) ?? null;
}

/**
 * Hängt die statischen AGB-Seiten an ein Angebots-PDF an und liefert das
 * kombinierte PDF. Best-effort: Schlägt das Zusammenführen fehl oder fehlen
 * die AGB, wird das ursprüngliche PDF unverändert zurückgegeben – ein
 * AGB-Problem darf niemals die Angebotserstellung verhindern.
 */
export async function appendAgb(offerPdf: Buffer, language: QuoteLanguage = "de"): Promise<Buffer> {
  const agb = loadAgb(language);
  if (!agb) return offerPdf;
  try {
    const out = await PDFDocument.load(offerPdf);
    const agbDoc = await PDFDocument.load(agb);
    const pages = await out.copyPages(agbDoc, agbDoc.getPageIndices());
    for (const page of pages) out.addPage(page);
    const merged = await out.save();
    return Buffer.from(merged);
  } catch (err) {
    logger.error(
      `AGB konnten nicht an das Angebot angehängt werden (Angebot bleibt ohne AGB): ${err instanceof Error ? err.message : err}`
    );
    return offerPdf;
  }
}

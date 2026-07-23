import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { Logger } from "@nestjs/common";

const logger = new Logger("PdfAppendix");

/**
 * Statischer AGB-Anhang: Die 4 AGB-Seiten werden 1:1 an jedes Angebots-PDF
 * gehängt. Die AGB liegen als festes Repo-Asset (configs/templates/agb-b2b.pdf)
 * und sind für alle Angebote gleich. Pfad per AGB_PDF_PATH überschreibbar.
 */
function agbPdfPath(): string | null {
  const candidates = [
    process.env["AGB_PDF_PATH"],
    resolve(process.cwd(), "../../configs/templates/agb-b2b.pdf"),
    resolve(process.cwd(), "configs/templates/agb-b2b.pdf"),
    resolve(__dirname, "../../../../../configs/templates/agb-b2b.pdf"),
    resolve(__dirname, "../../../../../../configs/templates/agb-b2b.pdf"),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => existsSync(p)) ?? null;
}

let cachedAgb: Buffer | null = null;
let agbResolved = false;

/** Lädt das AGB-PDF einmalig (best-effort). Fehlt es, wird null geliefert. */
function loadAgb(): Buffer | null {
  if (agbResolved) return cachedAgb;
  agbResolved = true;
  const path = agbPdfPath();
  if (!path) {
    logger.warn("AGB-PDF (configs/templates/agb-b2b.pdf) nicht gefunden – Angebote werden OHNE AGB-Anhang erzeugt.");
    return null;
  }
  try {
    cachedAgb = readFileSync(path);
  } catch (err) {
    logger.error(`AGB-PDF konnte nicht gelesen werden: ${err instanceof Error ? err.message : err}`);
    cachedAgb = null;
  }
  return cachedAgb;
}

/**
 * Hängt die statischen AGB-Seiten an ein Angebots-PDF an und liefert das
 * kombinierte PDF. Best-effort: Schlägt das Zusammenführen fehl oder fehlen
 * die AGB, wird das ursprüngliche PDF unverändert zurückgegeben – ein
 * AGB-Problem darf niemals die Angebotserstellung verhindern.
 */
export async function appendAgb(offerPdf: Buffer): Promise<Buffer> {
  const agb = loadAgb();
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

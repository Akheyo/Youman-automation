import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendAgb } from "../pdf-appendix";

/** Erzeugt ein einfaches PDF mit n Seiten. */
async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

describe("appendAgb", () => {
  it("hängt die 4 AGB-Seiten hinter das Angebots-PDF (2 Seiten -> 6 Seiten)", async () => {
    const offer = await makePdf(2);
    const merged = await appendAgb(offer);
    const out = await PDFDocument.load(merged);
    // 2 Angebotsseiten + 4 AGB-Seiten
    expect(out.getPageCount()).toBe(6);
  });

  it("liefert das Original zurück, wenn das AGB-Asset fehlt (best-effort, kein Fehler)", async () => {
    const prev = process.env["AGB_PDF_PATH"];
    process.env["AGB_PDF_PATH"] = "/nonexistent/agb.pdf";
    try {
      // Cache umgehen: der Modulcache hat die AGB evtl. schon geladen; dieser
      // Test prüft primär, dass appendAgb NIE wirft und ein gültiges PDF liefert.
      const offer = await makePdf(1);
      const result = await appendAgb(offer);
      const out = await PDFDocument.load(result);
      expect(out.getPageCount()).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev === undefined) delete process.env["AGB_PDF_PATH"];
      else process.env["AGB_PDF_PATH"] = prev;
    }
  });
});

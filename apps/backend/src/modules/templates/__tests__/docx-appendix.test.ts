import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { appendAgbDocx } from "../docx-appendix";
import { renderDocx } from "../docx-engine";

const TEMPLATE = readFileSync(resolve(__dirname, "../../../../../../configs/templates/beispiel-angebot.docx"));
const AGB = readFileSync(resolve(__dirname, "../../../../../../configs/templates/agb-b2b.docx"));

const DATA = {
  angebotsnummer: "2026-0042",
  datum: "2026-07-21",
  anrede: "Sehr geehrte Damen und Herren,",
  ansprechpartner: "Phil Kleinfeld",
  kunde_name: "Bergmann Handels GmbH",
  kunde_adresse: "Gewerbepark Süd 4a\n51149 Köln",
  positionen: [{ pos: 1, menge: 2, artikel_id: "54721", bezeichnung: "Federbein", nettopreis: "1.234,56" }],
  zwischensumme: "1.234,56",
  rabatt: "0,00",
  endbetrag: "1.234,56",
  lieferdatum: "ab sofort",
  zahlungsart: "Rechnung",
  zahlungsziel: "7 Tage netto",
  versandart: "Spedition",
};

const OFFER = renderDocx(TEMPLATE, DATA);

function text(zip: PizZip, part: string): string {
  return zip.file(part)!.asText();
}

describe("appendAgbDocx", () => {
  const result = new PizZip(appendAgbDocx(OFFER));
  const document = text(result, "word/document.xml");
  const rels = text(result, "word/_rels/document.xml.rels");
  const contentTypes = text(result, "[Content_Types].xml");

  it("keeps the package OPC-conform", () => {
    const names = Object.keys(result.files);
    expect(names.filter((n) => result.files[n]!.dir)).toEqual([]);
    expect(names[0]).toBe("[Content_Types].xml");
    const defaults = new Set(
      [...contentTypes.matchAll(/Extension="([^"]+)"/g)].map((m) => m[1]!.toLowerCase())
    );
    const overrides = new Set([...contentTypes.matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1]!));
    for (const name of names.filter((n) => n !== "[Content_Types].xml")) {
      const ext = name.split(".").pop()!.toLowerCase();
      expect(overrides.has(name) || defaults.has(ext), `kein Content-Type für ${name}`).toBe(true);
    }
  });

  it("carries the AGB text into the document", () => {
    const agbText = text(new PizZip(AGB), "word/document.xml").replace(/<[^>]+>/g, "");
    // Stichproben aus allen vier Seiten – die AGB dürfen nicht gekürzt werden.
    for (const probe of ["Geltungsbereich", "Vertragsschluss", "Höhere Gewalt", "Eigentumsvorbehalt"]) {
      expect(agbText).toContain(probe);
      expect(document.replace(/<[^>]+>/g, "")).toContain(probe);
    }
    // Das Angebot selbst bleibt erhalten.
    expect(document).toContain("Bergmann Handels GmbH");
  });

  it("puts the AGB into their own section without the letterhead", () => {
    // Zwei sectPr: eines beendet das Angebot, das letzte gehört zu den AGB.
    expect((document.match(/<w:sectPr/g) ?? []).length).toBe(2);
    const lastSect = document.slice(document.lastIndexOf("<w:sectPr"));
    const headerId = /<w:headerReference[^>]*r:id="(rId\d+)"/.exec(lastSect)?.[1];
    const footerId = /<w:footerReference[^>]*r:id="(rId\d+)"/.exec(lastSect)?.[1];
    expect(headerId).toBeTruthy();
    expect(footerId).toBeTruthy();
    expect(rels).toContain(`Id="${headerId}" Type="${"http://schemas.openxmlformats.org/officeDocument/2006/relationships/header"}" Target="headerAgb.xml"`);
    expect(rels).toContain(`Id="${footerId}" Type="${"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer"}" Target="footerAgb.xml"`);
    // Die leeren Kopf-/Fußzeilen tragen keinen Briefbogen.
    expect(text(result, "word/headerAgb.xml")).not.toContain("<w:t");
    expect(text(result, "word/footerAgb.xml")).not.toContain("<w:t");
  });

  it("rewrites ids so nothing collides with the template", () => {
    const docPrIds = [...document.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]);
    expect(new Set(docPrIds).size).toBe(docPrIds.length);
    for (const id of new Set([...document.matchAll(/r:embed="(rId\d+)"/g)].map((m) => m[1]))) {
      expect(rels, `Beziehung ${id} fehlt`).toContain(`Id="${id}"`);
    }
    for (const [, , target] of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
      if (target!.startsWith("http")) continue;
      expect(result.file(`word/${target}`), `Ziel ${target} fehlt`).toBeTruthy();
    }
  });

  it("returns the input unchanged when merging fails", () => {
    // Best-effort: Ein Problem beim Anhängen darf die Angebotserstellung nie
    // scheitern lassen – dann kommt das Angebot ohne AGB zurück.
    const broken = Buffer.from("kein zip");
    expect(appendAgbDocx(broken)).toEqual(broken);
  });
});

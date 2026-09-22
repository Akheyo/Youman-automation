import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { extractTemplateStructure, formatTemplateData, renderDocx } from "../docx-engine";

const vorlage = (sprache: "de" | "en") =>
  readFileSync(resolve(__dirname, `../../../../../../configs/templates/amikon-angebot-${sprache}.docx`));

const positionen = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    pos: i + 1, menge: 1, artikel_id: String(21000 + i),
    bezeichnung: `Artikel ${i + 1}`, nettopreis: "149,80",
  }));

const daten = (n: number) => ({
  angebotsnummer: "1042", datum: "2026-09-22", anrede: "Sehr geehrte Damen und Herren,",
  ansprechpartner: "Max Admin", kunde_name: "Tesla Engineering Germany GmbH",
  kunde_adresse: "Hauptstraße 1\n10115 Berlin",
  lieferadresse: "Werk Grünheide, Tor 3\n15537 Grünheide",
  lieferdatum: "ab sofort", zahlungsart: "Vorauszahlung", zahlungsziel: "14 Tage netto",
  endbetrag: "257,30", positionen: positionen(n), seitenumbruch: n >= 4,
});

/** Anzahl harter Seitenumbrüche im erzeugten Dokument. */
function umbrueche(docx: Buffer): number {
  const xml = new PizZip(docx).file("word/document.xml")!.asText();
  return (xml.match(/<w:br w:type="page"\/>/g) ?? []).length;
}

describe("formatTemplateData", () => {
  it("leaves booleans alone", () => {
    // Der eigentliche Fehler: formatValue machte aus false den String "false".
    // Der ist nicht leer und damit wahr – ein ausgeschalteter Abschnitt der
    // Form {{#tag}}…{{/tag}} liess sich so nie ausschalten.
    const structure = { placeholders: ["a", "b"], loops: {}, scalars: ["a", "b"] };
    const out = formatTemplateData(structure, { a: false, b: true });
    expect(out["a"]).toBe(false);
    expect(out["b"]).toBe(true);
  });

  it("still formats everything else", () => {
    const structure = { placeholders: ["n", "d", "t"], loops: {}, scalars: ["n", "d", "t"] };
    const out = formatTemplateData(structure, { n: 1234.5, d: "2026-08-14", t: null });
    expect(out["n"]).toBe("1.234,50");
    expect(out["d"]).toBe("14.08.2026");
    expect(out["t"]).toBe("");
  });
});

describe("Seitenumbruch ab vier Positionen", () => {
  for (const sprache of ["de", "en"] as const) {
    it(`${sprache}: template carries the condition`, () => {
      expect(extractTemplateStructure(vorlage(sprache)).placeholders).toContain("seitenumbruch");
    });

    it(`${sprache}: up to three positions stay on one page`, () => {
      for (const n of [1, 2, 3]) {
        expect(umbrueche(renderDocx(vorlage(sprache), daten(n), sprache)), `${n} Positionen`).toBe(0);
      }
    });

    it(`${sprache}: from four positions the rest moves to page two`, () => {
      for (const n of [4, 7, 12]) {
        expect(umbrueche(renderDocx(vorlage(sprache), daten(n), sprache)), `${n} Positionen`).toBe(1);
      }
    });
  }
});

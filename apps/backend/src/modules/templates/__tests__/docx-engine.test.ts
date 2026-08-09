import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import {
  extractTemplateStructure,
  findMissingFields,
  renderDocx,
} from "../docx-engine";
import { MissingFieldsError, TemplateParseError } from "../errors";

const TEMPLATE = readFileSync(resolve(__dirname, "../../../../../../configs/templates/beispiel-angebot.docx"));

const FULL_DATA = {
  angebotsnummer: "2026-0042",
  datum: "2026-07-21",
  anrede: "Sehr geehrter Herr Thomas,",
  ansprechpartner: "Jessica Niestatek",
  kunde_name: "stephan Thomas",
  kunde_adresse: "Musterstraße 12\n46325 Borken",
  positionen: [
    { pos: 1, menge: 2, artikel_id: "54721", bezeichnung: "Federbein vorne links", nettopreis: "1.234,56" },
    { pos: 2, menge: 1, artikel_id: "3732", bezeichnung: "Transportkosten", nettopreis: "150,00" },
  ],
  zwischensumme: "1.384,56",
  rabatt: "0,00",
  endbetrag: "1.384,56",
  lieferdatum: "ab sofort",
  zahlungsart: "Rechnung",
  zahlungsziel: "7 Tage netto",
  versandart: "Spedition",
};

function extractDocumentText(docx: Buffer): string {
  const zip = new PizZip(docx);
  const xml = zip.file("word/document.xml")!.asText();
  return xml.replace(/<[^>]+>/g, " ");
}

describe("extractTemplateStructure", () => {
  it("finds all scalar placeholders and the positions loop", () => {
    const structure = extractTemplateStructure(TEMPLATE);
    for (const tag of ["angebotsnummer", "datum", "anrede", "ansprechpartner", "kunde_name", "kunde_adresse",
      "zwischensumme", "rabatt", "endbetrag", "lieferdatum", "zahlungsart", "zahlungsziel", "versandart"]) {
      expect(structure.scalars).toContain(tag);
    }
    expect(structure.loops["positionen"]).toEqual(
      expect.arrayContaining(["pos", "menge", "artikel_id", "bezeichnung", "nettopreis"])
    );
    expect(structure.placeholders).toContain("positionen.nettopreis");
  });

  it("rejects non-DOCX uploads with TemplateParseError", () => {
    expect(() => extractTemplateStructure(Buffer.from("das ist kein zip"))).toThrow(TemplateParseError);
  });
});

describe("findMissingFields", () => {
  const structure = extractTemplateStructure(TEMPLATE);

  it("returns empty list when everything is covered", () => {
    expect(findMissingFields(structure, FULL_DATA)).toEqual([]);
  });

  it("lists missing scalars and loop children", () => {
    const { anrede: _anrede, ...withoutAnrede } = FULL_DATA;
    const data = {
      ...withoutAnrede,
      positionen: [{ pos: 1, menge: 2, artikel_id: "x", bezeichnung: "y" }], // nettopreis fehlt
    };
    const missing = findMissingFields(structure, data as Record<string, unknown>);
    expect(missing).toContain("anrede");
    expect(missing).toContain("positionen.nettopreis");
  });

  it("treats empty strings and a missing array as missing", () => {
    const missing = findMissingFields(structure, { ...FULL_DATA, anrede: "  ", positionen: undefined });
    expect(missing).toContain("anrede");
    expect(missing).toContain("positionen");
  });
});

describe("renderDocx", () => {
  it("fills all values (verified by unzipping the DOCX)", () => {
    const out = renderDocx(TEMPLATE, FULL_DATA);
    const text = extractDocumentText(out);
    expect(text).toContain("An-2026-0042");
    expect(text).toContain("stephan Thomas");
    expect(text).toContain("Federbein vorne links");
    expect(text).toContain("Transportkosten");
    expect(text).toContain("1.384,56");
    expect(text).toContain("21.07.2026"); // ISO-Datum deutsch formatiert
    expect(text).not.toContain("{{");
  });

  it("duplicates the position row per entry (0, 1 and many)", () => {
    const count = (buf: Buffer, needle: string) => extractDocumentText(buf).split(needle).length - 1;
    const mk = (n: number) =>
      renderDocx(TEMPLATE, {
        ...FULL_DATA,
        positionen: Array.from({ length: n }, (_, i) => ({
          pos: i + 1, menge: 1, artikel_id: `A${i}`, bezeichnung: `Artikel ${i}`, nettopreis: "1,00",
        })),
      });
    expect(count(mk(0), "Artikel ")).toBe(0);
    expect(count(mk(1), "Artikel 0")).toBe(1);
    const many = mk(5);
    for (let i = 0; i < 5; i++) expect(extractDocumentText(many)).toContain(`Artikel ${i}`);
  });

  it("produces an OPC-conform package that Word accepts", () => {
    // Regression: PizZip legte beim Zurückschreiben Verzeichniseinträge an und
    // schob [Content_Types].xml aus Position 1. Word lehnte die Datei dann ab
    // ("Fehler beim Öffnen der Datei in Word"), LibreOffice nicht – deshalb war
    // nur der DOCX-Download kaputt, die PDF-Ausgabe aber in Ordnung.
    const zip = new PizZip(renderDocx(TEMPLATE, FULL_DATA));
    const names = Object.keys(zip.files);
    expect(names.filter((n) => zip.files[n]!.dir)).toEqual([]);
    expect(names.filter((n) => n.endsWith("/"))).toEqual([]);
    expect(names[0]).toBe("[Content_Types].xml");

    // Jeder Part muss einen Content-Type haben (Default über Endung oder Override).
    const contentTypes = zip.file("[Content_Types].xml")!.asText();
    const defaults = new Set(
      [...contentTypes.matchAll(/Extension="([^"]+)"/g)].map((m) => m[1]!.toLowerCase())
    );
    const overrides = new Set([...contentTypes.matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1]!));
    for (const name of names.filter((n) => n !== "[Content_Types].xml")) {
      const ext = name.split(".").pop()!.toLowerCase();
      expect(overrides.has(name) || defaults.has(ext), `kein Content-Type für ${name}`).toBe(true);
    }

    // Keine Parts der Ausgangsdatei verloren.
    const source = new PizZip(TEMPLATE);
    for (const name of Object.keys(source.files).filter((n) => !source.files[n]!.dir)) {
      expect(names).toContain(name);
    }
  });

  it("refuses to render with missing fields and lists them", () => {
    const { endbetrag: _e, ...data } = FULL_DATA;
    try {
      renderDocx(TEMPLATE, data as Record<string, unknown>);
      expect.unreachable("sollte MissingFieldsError werfen");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFieldsError);
      expect((err as MissingFieldsError).fields).toEqual(["endbetrag"]);
    }
  });
});

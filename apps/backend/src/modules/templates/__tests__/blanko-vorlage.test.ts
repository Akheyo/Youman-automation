import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { renderDocx, extractTemplateStructure } from "../docx-engine";

const DATA = {
  angebotsnummer: "1042",
  datum: "2026-08-21",
  anrede: "Sehr geehrte Damen und Herren,",
  ansprechpartner: "Akheyo",
  kunde_name: "Tesla Engineering Germany GmbH",
  kunde_adresse: "Hauptstraße 1\n10115 Berlin",
  lieferadresse: "Werk Grünheide, Tor 3\n15537 Grünheide",
  lieferdatum: "ab sofort",
  zahlungsart: "Rechnung",
  zahlungsziel: "14 Tage netto",
  endbetrag: "257,30",
  positionen: [
    { pos: 1, menge: 2, artikel_id: "21001", bezeichnung: "Trekkingrucksack Fjell 50 L schwarz", nettopreis: "149,80" },
    { pos: 2, menge: 5, artikel_id: "33100", bezeichnung: "Isolierflasche Thermo 0,75 L Edelstahl", nettopreis: "107,50" },
    { pos: 3, menge: 1, artikel_id: "99001", bezeichnung: "Rabatt Rahmenvereinbarung", nettopreis: "-40,00" },
  ],
};

describe("Blanko-Angebotsvorlage", () => {
  const file = readFileSync(resolve(__dirname, "../../../../../../configs/templates/blanko-angebot-de.docx"));

  it("uses only placeholders the server actually fills", () => {
    const ph = extractTemplateStructure(file).placeholders.sort();
    expect(ph).toEqual([
      "anrede", "angebotsnummer", "ansprechpartner", "datum", "endbetrag",
      "kunde_adresse", "kunde_name", "lieferadresse", "lieferdatum", "positionen",
      "positionen.artikel_id", "positionen.bezeichnung", "positionen.menge",
      "positionen.nettopreis", "positionen.pos", "zahlungsart", "zahlungsziel",
    ].sort());
  });

  it("renders with real quote data", () => {
    const out = renderDocx(file, DATA, "de");
    const xml = new PizZip(out).file("word/document.xml")!.asText();
    expect(xml).toContain("Tesla Engineering Germany GmbH");
    // Die Absenderfelder bleiben als Klartext stehen, damit sie in Word
    // einmalig überschrieben werden können.
    expect(xml).toContain("[Ihr Firmenname]");
  });
});

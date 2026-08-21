import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderDocx, extractTemplateStructure } from "../docx-engine";

const DATA = {
  rechnungsnummer: "RE-2026-0042",
  datum: "2026-08-21",
  faelligkeitsdatum: "2026-09-04",
  ansprechpartner: "Akheyo",
  kunde_name: "Tesla Engineering Germany GmbH",
  kunde_adresse: "Hauptstraße 1\n10115 Berlin",
  lieferadresse: "Werk Grünheide, Tor 3\n15537 Grünheide",
  leistungsdatum: "18.08.2026",
  zahlungsart: "Überweisung",
  zahlungsziel: "14 Tage netto",
  nettobetrag: "257,30",
  steuersatz: "19",
  steuerbetrag: "48,89",
  gesamtbetrag: "306,19",
  positionen: [
    { pos: 1, menge: 2, artikel_id: "21001", bezeichnung: "Trekkingrucksack Fjell 50 L schwarz", nettopreis: "149,80" },
    { pos: 2, menge: 5, artikel_id: "33100", bezeichnung: "Isolierflasche Thermo 0,75 L Edelstahl", nettopreis: "107,50" },
  ],
};

describe("Rechnungsvorlage", () => {
  const file = readFileSync(resolve(__dirname, "../../../../../../configs/templates/amikon-rechnung-de.docx"));

  it("carries exactly the placeholders the data covers", () => {
    const ph = extractTemplateStructure(file).placeholders.sort();
    expect(ph).toEqual([
      "ansprechpartner", "datum", "faelligkeitsdatum", "gesamtbetrag", "kunde_adresse", "kunde_name",
      "leistungsdatum", "lieferadresse", "nettobetrag", "positionen",
      "positionen.artikel_id", "positionen.bezeichnung", "positionen.menge",
      "positionen.nettopreis", "positionen.pos", "rechnungsnummer", "steuerbetrag",
      "steuersatz", "zahlungsart", "zahlungsziel",
    ]);
    expect(ph).not.toContain("angebotsnummer");
  });

  it("renders without leftover quote wording", () => {
    const out = renderDocx(file, DATA, "de");
    const xml = out.toString("latin1");
    for (const wort of ["Angebot", "angebotsnummer"]) expect(xml).not.toContain(wort);
  });
});

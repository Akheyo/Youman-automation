import { describe, expect, it, vi } from "vitest";
import type { Country } from "@youman/shared";
import { SearchService } from "../search.service";
import { FALLBACK_COUNTRIES } from "../countries";

/** SearchService mit einem Connector, der sich beim Länderabruf so verhält. */
function serviceWith(getCountries?: () => Promise<Country[]>): SearchService {
  const connector: Record<string, unknown> = {};
  if (getCountries) connector["getCountries"] = getCountries;
  return new SearchService({ getConnector: async () => connector } as never);
}

const LIVE: Country[] = [
  { code: "DE", name: "Deutschland", externalId: "1" },
  { code: "JP", name: "Japan", externalId: "77" },
  { code: "AE", name: "Vereinigte Arabische Emirate", externalId: "90" },
];

describe("getCountries", () => {
  it("uses the list the ERP reports", async () => {
    const { items } = await serviceWith(async () => LIVE).getCountries("t1");
    expect(items).toEqual(LIVE);
  });

  it("falls back when the connector cannot report countries", async () => {
    // Nicht jedes angebundene System kann das – die Kundenanlage darf daran
    // nicht scheitern.
    const { items } = await serviceWith().getCountries("t1");
    expect(items).toEqual(FALLBACK_COUNTRIES);
  });

  it("falls back when the call fails", async () => {
    const { items } = await serviceWith(async () => {
      throw new Error("Plenty nicht erreichbar");
    }).getCountries("t1");
    expect(items).toEqual(FALLBACK_COUNTRIES);
  });

  it("falls back on an empty answer instead of showing nothing", async () => {
    const { items } = await serviceWith(async () => []).getCountries("t1");
    expect(items).toEqual(FALLBACK_COUNTRIES);
  });

  it("filters by name and by code", async () => {
    const svc = serviceWith(async () => LIVE);
    expect((await svc.getCountries("t1", "japan")).items.map((c) => c.code)).toEqual(["JP"]);
    expect((await svc.getCountries("t1", "emirate")).items.map((c) => c.code)).toEqual(["AE"]);
    expect((await svc.getCountries("t1", "de")).items.map((c) => c.code)).toEqual(["DE"]);
    expect((await svc.getCountries("t1", "  ")).items).toHaveLength(3);
  });

  it("offers far more than the six countries the form had", async () => {
    const { items } = await serviceWith().getCountries("t1");
    expect(items.length).toBeGreaterThan(20);
    // Alphabetisch nach deutschem Namen, damit die Liste bedienbar bleibt.
    expect(items.map((c) => c.name)).toEqual([...items.map((c) => c.name)].sort((a, b) => a.localeCompare(b, "de")));
  });

  it("carries the id the ERP addresses the country by", async () => {
    // Ohne sie legte der Connector die Adresse im falschen Land an.
    for (const c of FALLBACK_COUNTRIES) expect(Number(c.externalId)).toBeGreaterThan(0);
  });
});

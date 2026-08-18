import { describe, expect, it } from "vitest";
import type { Address } from "@youman/shared";
import { SearchService } from "../search.service";

const address = (over: Partial<Address> = {}): Address => ({
  id: "42",
  type: "shipping",
  street: "Berliner Straße",
  streetNumber: "1",
  zip: "15537",
  city: "Grünheide",
  countryCode: "DE",
  isDefault: false,
  ...over,
});

/** SearchService mit einem Connector, der genau diese Adressen liefert. */
function serviceFor(addresses: Address[]): SearchService {
  const connectors = {
    getConnector: async () => ({ getCustomerAddresses: async () => addresses }),
  };
  return new SearchService(connectors as never);
}

describe("getCustomerAddresses", () => {
  it("wraps the addresses in items", async () => {
    // Der eigentliche Fehler: Die Oberfläche liest ausschließlich items. Ein
    // blankes Array kam dort als "Keine Einträge gefunden" an.
    const result = await serviceFor([address()]).getCustomerAddresses("t1", "c1");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("builds one line for the address and one for its kind", async () => {
    const [item] = (await serviceFor([address({ isDefault: true })]).getCustomerAddresses("t1", "c1")).items;
    expect(item!.label).toBe("Berliner Straße 1, 15537 Grünheide");
    expect(item!.description).toBe("Lieferadresse (Standard)");
  });

  it("names the kind of every address type", async () => {
    const addresses = [
      address({ id: "1", type: "billing" }),
      address({ id: "2", type: "both" }),
    ];
    const { items } = await serviceFor(addresses).getCustomerAddresses("t1", "c1");
    expect(items.map((i) => i.description).sort()).toEqual(
      ["Liefer- und Rechnungsadresse", "Rechnungsadresse"]
    );
  });

  it("puts the address best suited for delivery first", async () => {
    // Das Formular übernimmt die erste Adresse, also muss dort die
    // Standard-Lieferadresse stehen und nicht irgendeine Rechnungsadresse.
    const addresses = [
      address({ id: "1", type: "billing", isDefault: true }),
      address({ id: "2", type: "both" }),
      address({ id: "3", type: "shipping", isDefault: false }),
      address({ id: "4", type: "shipping", isDefault: true }),
    ];
    const { items } = await serviceFor(addresses).getCustomerAddresses("t1", "c1");
    expect(items.map((i) => i.id)).toEqual(["4", "3", "2", "1"]);
  });

  it("hands over the address in the two lines the quote prints", async () => {
    const { items } = await serviceFor([address()]).getCustomerAddresses("t1", "c1");
    expect(items[0]!.postalAddress).toBe("Berliner Stra\u00dfe 1\n15537 Gr\u00fcnheide");
  });

  it("stays selectable when the street is missing", async () => {
    // Ohne Ersatztext bliebe die Zeile leer und die Adresse unklickbar.
    const { items } = await serviceFor([address({ street: "", streetNumber: "", zip: "", city: "" })])
      .getCustomerAddresses("t1", "c1");
    expect(items[0]!.label).toBe("Adresse 42");
  });

  it("keeps the id as the value the form stores", async () => {
    const { items } = await serviceFor([address({ id: "777" })]).getCustomerAddresses("t1", "c1");
    expect(items[0]!.id).toBe("777");
  });

  it("returns an empty list instead of failing for a customer without addresses", async () => {
    const result = await serviceFor([]).getCustomerAddresses("t1", "c1");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

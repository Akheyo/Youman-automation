import { Injectable } from "@nestjs/common";
import { ConnectorsService } from "../connectors/connectors.service";
import type { SearchRequest, SearchResult, Customer, Product, Address } from "@youman/shared";

/** Adresse mit den beiden Feldern, die die Auswahlliste anzeigt. */
export interface AddressOption extends Address {
  label: string;
  description: string;
}

const ADDRESS_KIND: Record<Address["type"], string> = {
  shipping: "Lieferadresse",
  billing: "Rechnungsadresse",
  both: "Liefer- und Rechnungsadresse",
};

/**
 * Baut die Anzeigetexte fuer die Auswahlliste.
 *
 * Die Liste zeigt genau zwei Zeilen an, jede aus einem einzelnen Feld. Eine
 * Adresse ueber mehrere Felder verteilt waere dort nicht darstellbar, deshalb
 * kommen die fertigen Zeilen vom Server.
 */
function toOption(address: Address): AddressOption {
  const street = [address.street, address.streetNumber].filter(Boolean).join(" ").trim();
  const place = [address.zip, address.city].filter(Boolean).join(" ").trim();
  const kind = ADDRESS_KIND[address.type] ?? "Adresse";
  return {
    ...address,
    // Ohne Strasse bliebe die Zeile leer und die Adresse waere nicht anwaehlbar.
    label: [street, place].filter(Boolean).join(", ") || `Adresse ${address.id}`,
    description: address.isDefault ? `${kind} (Standard)` : kind,
  };
}

@Injectable()
export class SearchService {
  constructor(private readonly connectors: ConnectorsService) {}

  async searchCustomers(tenantId: string, req: SearchRequest): Promise<SearchResult<Customer>> {
    const connector = await this.connectors.getConnector(tenantId);
    return connector.searchCustomers(req);
  }

  async searchProducts(tenantId: string, req: SearchRequest): Promise<SearchResult<Product>> {
    const connector = await this.connectors.getConnector(tenantId);
    return connector.searchProducts(req);
  }

  /**
   * Adressen eines Kunden fuer die Auswahlliste "Lieferadresse".
   *
   * Die Antwort traegt wie die uebrigen Suchen ein items-Feld: Die Oberflaeche
   * liest ausschliesslich items, ein blankes Array kam dort als "Keine Eintraege
   * gefunden" an, obwohl der Kunde Adressen hatte.
   */
  async getCustomerAddresses(
    tenantId: string,
    customerId: string
  ): Promise<SearchResult<AddressOption>> {
    const startedAt = Date.now();
    const connector = await this.connectors.getConnector(tenantId);
    const items = (await connector.getCustomerAddresses(customerId)).map(toOption);
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      hasMore: false,
      searchDurationMs: Date.now() - startedAt,
    };
  }

  async getProductStock(tenantId: string, productId: string, warehouseId?: string) {
    const connector = await this.connectors.getConnector(tenantId);
    return connector.getProductStock(productId, warehouseId);
  }

  async getProductPrice(tenantId: string, productId: string, customerId?: string, quantity?: number) {
    const connector = await this.connectors.getConnector(tenantId);
    return connector.getProductPrice(productId, customerId, quantity);
  }
}

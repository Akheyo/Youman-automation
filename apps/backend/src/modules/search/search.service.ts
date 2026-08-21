import { Injectable, Logger } from "@nestjs/common";
import { ConnectorsService } from "../connectors/connectors.service";
import { FALLBACK_COUNTRIES } from "./countries";
import type { SearchRequest, SearchResult, Customer, Product, Address, Country } from "@youman/shared";

/** Adresse mit den fertigen Anzeige- und Uebernahmetexten. */
export interface AddressOption extends Address {
  /** Einzeilig fuer die Auswahlliste. */
  label: string;
  /** Art der Adresse, zweite Zeile der Auswahlliste. */
  description: string;
  /** Zweizeilig, so wie sie im Angebot steht. */
  postalAddress: string;
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
    postalAddress: [street, place].filter(Boolean).join("\n"),
  };
}

/**
 * Reihenfolge fuer die Lieferanschrift: Die erste Adresse wird im Formular
 * vorgeschlagen, deshalb steht die Standard-Lieferadresse vorn, danach weitere
 * Lieferadressen, zuletzt reine Rechnungsadressen.
 */
const DELIVERY_RANK: Record<Address["type"], number> = { shipping: 0, both: 1, billing: 2 };

function byDeliverySuitability(a: Address, b: Address): number {
  const rank = DELIVERY_RANK[a.type] - DELIVERY_RANK[b.type];
  if (rank !== 0) return rank;
  return Number(b.isDefault) - Number(a.isDefault);
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

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
    const items = (await connector.getCustomerAddresses(customerId))
      .slice()
      .sort(byDeliverySuitability)
      .map(toOption);
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      hasMore: false,
      searchDurationMs: Date.now() - startedAt,
    };
  }

  /**
   * Laenderauswahl fuer "Kunde anlegen".
   *
   * Die Liste kommt vom angebundenen System, weil dort auch die Landes-ID
   * gepflegt wird, mit der adept die Adresse anlegt. Eine fest eingebaute Liste
   * war auf sechs Laender beschraenkt, und alles darueber hinaus haette der
   * Connector still nach Deutschland gebogen.
   */
  async getCountries(tenantId: string, query = ""): Promise<SearchResult<Country>> {
    const startedAt = Date.now();
    const connector = await this.connectors.getConnector(tenantId);
    let items = FALLBACK_COUNTRIES;
    if (typeof connector.getCountries === "function") {
      try {
        const live = await connector.getCountries();
        if (live.length > 0) items = live;
      } catch (err) {
        this.logger.warn(
          `Laenderliste des ERP nicht abrufbar, feste Liste wird verwendet: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    // Tippen filtert: Bei ueber 200 Laendern ist Scrollen keine Suche. Der
    // Code zaehlt mit, damit "DE" genauso findet wie "Deutsch".
    const needle = query.trim().toLowerCase();
    if (needle) {
      items = items.filter(
        (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().startsWith(needle)
      );
    }

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

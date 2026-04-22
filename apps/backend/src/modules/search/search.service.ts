import { Injectable } from "@nestjs/common";
import { ConnectorsService } from "../connectors/connectors.service";
import type { SearchRequest, SearchResult, Customer, Product } from "@youman/shared";

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

  async getCustomerAddresses(tenantId: string, customerId: string) {
    const connector = await this.connectors.getConnector(tenantId);
    return connector.getCustomerAddresses(customerId);
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

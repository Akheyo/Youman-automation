import type { ConnectorConfig } from "@youman/shared";
import type { IErpConnector } from "./IErpConnector";
import { SapODataConnector } from "./SapODataConnector";
import { MockErpConnector } from "./MockErpConnector";
import type { SapConfig } from "../types/SapConfig";

export class ConnectorFactory {
  static create(config: ConnectorConfig): IErpConnector {
    switch (config.connectorType) {
      case "SAP_ODATA":
      case "SAP_RFC":
      case "SAP_BAPI":
        return new SapODataConnector(config.tenantId, config.config as unknown as SapConfig);
      case "MOCK":
        return new MockErpConnector(config.tenantId);
      default:
        throw new Error(`Unknown connector type: ${config.connectorType}`);
    }
  }
}

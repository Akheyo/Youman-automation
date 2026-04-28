import type { ConnectorConfig } from "@youman/shared";
import type { IErpConnector } from "./IErpConnector";
import { SapODataConnector } from "./SapODataConnector";
import { MockErpConnector } from "./MockErpConnector";
import { RestGenericConnector } from "./RestGenericConnector";
import type { SapConfig } from "../types/SapConfig";
import type { RestGenericConfig } from "./RestGenericConnector";

export class ConnectorFactory {
  static create(config: ConnectorConfig): IErpConnector {
    switch (config.connectorType) {
      case "SAP_ODATA":
      case "SAP_RFC":
      case "SAP_BAPI":
        return new SapODataConnector(config.tenantId, config.config as unknown as SapConfig);
      case "REST_GENERIC":
        return new RestGenericConnector(config.tenantId, config.config as unknown as RestGenericConfig);
      case "MOCK":
        return new MockErpConnector(config.tenantId);
      default:
        return new MockErpConnector(config.tenantId);
    }
  }
}

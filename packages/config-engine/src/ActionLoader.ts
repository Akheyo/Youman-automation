import type { ActionDefinition } from "@youman/shared";
import type { ActionRegistry } from "./ActionRegistry";

export interface ActionConfigSource {
  type: "json" | "api" | "file";
  data?: ActionDefinition[];
  url?: string;
  path?: string;
}

export class ActionLoader {
  constructor(private readonly registry: ActionRegistry) {}

  loadFromArray(actions: ActionDefinition[]): void {
    this.registry.registerMany(actions);
  }

  loadFromJson(json: string): void {
    const parsed = JSON.parse(json) as ActionDefinition[];
    if (!Array.isArray(parsed)) {
      throw new Error("Action config must be a JSON array");
    }
    this.registry.registerMany(parsed);
  }

  mergeWithOverrides(
    base: ActionDefinition[],
    overrides: Partial<ActionDefinition>[]
  ): ActionDefinition[] {
    return base.map((action) => {
      const override = overrides.find((o) => o.id === action.id);
      if (!override) return action;
      return { ...action, ...override } as ActionDefinition;
    });
  }
}

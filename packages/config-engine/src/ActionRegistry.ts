import type { ActionDefinition, UserRole } from "@youman/shared";

export class ActionRegistry {
  private actions = new Map<string, ActionDefinition>();

  register(action: ActionDefinition): void {
    this.actions.set(action.id, action);
  }

  registerMany(actions: ActionDefinition[]): void {
    for (const action of actions) {
      this.register(action);
    }
  }

  get(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  getOrThrow(id: string): ActionDefinition {
    const action = this.actions.get(id);
    if (!action) {
      throw new Error(`Action '${id}' not found in registry`);
    }
    return action;
  }

  getAll(): ActionDefinition[] {
    return Array.from(this.actions.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
  }

  getForRole(role: UserRole): ActionDefinition[] {
    return this.getAll().filter(
      (a) => a.enabled && a.allowedRoles.includes(role)
    );
  }

  getByCategory(category: ActionDefinition["category"]): ActionDefinition[] {
    return this.getAll().filter((a) => a.category === category);
  }

  has(id: string): boolean {
    return this.actions.has(id);
  }

  remove(id: string): boolean {
    return this.actions.delete(id);
  }

  clear(): void {
    this.actions.clear();
  }

  size(): number {
    return this.actions.size;
  }
}

export const globalActionRegistry = new ActionRegistry();

import type { DocumentFieldMapping } from "@youman/shared";

/**
 * Resolves an action's documentOutput.fieldMapping against the executed
 * action's form payload and connector result.
 *
 * Path syntax (deliberately small, no external JSONPath dependency):
 *   "$.form.<a>.<b>"    → value from the form payload
 *   "$.result.<a>"      → value from the connector result
 *   "$.meta.<a>"        → execution metadata (datum, userName, userEmail)
 *   "<path>[*]"         → the array at <path>; combined with itemMapping the
 *                          entries are mapped ("$.quantity" relative to the
 *                          item, "$pos" = 1-based index)
 *   anything else       → literal constant
 */
export interface MappingContext {
  form: Record<string, unknown>;
  result: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export function resolveFieldMapping(
  mapping: DocumentFieldMapping,
  context: MappingContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [placeholder, rule] of Object.entries(mapping)) {
    if (typeof rule === "string") {
      out[placeholder] = rule.endsWith("[*]")
        ? resolveArray(rule, context)
        : resolvePath(rule, context);
    } else {
      const rows = resolveArray(rule.path, context);
      out[placeholder] = rows.map((item, index) => {
        const row: Record<string, unknown> = {};
        for (const [key, itemRule] of Object.entries(rule.itemMapping)) {
          row[key] = resolveItemPath(itemRule, item, index);
        }
        return row;
      });
    }
  }
  return out;
}

function resolvePath(path: string, context: MappingContext): unknown {
  if (!path.startsWith("$.")) return path; // literal
  const segments = path.slice(2).split(".");
  const rootKey = segments.shift();
  const root =
    rootKey === "form" ? context.form : rootKey === "result" ? context.result : rootKey === "meta" ? context.meta : undefined;
  if (root === undefined) return undefined;
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function resolveArray(path: string, context: MappingContext): unknown[] {
  const base = path.endsWith("[*]") ? path.slice(0, -3) : path;
  const value = resolvePath(base, context);
  return Array.isArray(value) ? value : [];
}

function resolveItemPath(rule: string, item: unknown, index: number): unknown {
  if (rule === "$pos") return index + 1;
  if (!rule.startsWith("$.")) return rule; // literal
  let current: unknown = item;
  for (const seg of rule.slice(2).split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

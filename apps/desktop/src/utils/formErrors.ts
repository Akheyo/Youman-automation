import type { FieldErrors } from "react-hook-form";

/**
 * Reads a react-hook-form error message for a possibly-nested field key.
 * `register("address.street")` stores errors nested (errors.address.street),
 * so a flat `errors["address.street"]` lookup would miss them.
 */
export function fieldErrorMessage(errors: FieldErrors, key: string): string | undefined {
  const node = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, errors);
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}

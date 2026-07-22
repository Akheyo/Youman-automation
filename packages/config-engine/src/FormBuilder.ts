import { z, type ZodTypeAny } from "zod";
import type {
  ActionDefinition,
  FieldDefinition,
  FieldConstraint,
} from "@youman/shared";

export type FormValues = Record<string, unknown>;

/**
 * Dynamically builds a Zod validation schema from an ActionDefinition.
 * This allows config-driven forms without writing validation code per action.
 */
export class FormBuilder {
  buildZodSchema(action: ActionDefinition): ZodTypeAny {
    const shape: Record<string, ZodTypeAny> = {};
    // Dotted field keys (e.g. "address.street") map to nested objects, because
    // react-hook-form's register("address.street") writes {address:{street}}.
    // A flat schema key would never match that nested value and would block
    // submission silently. Group such keys into a nested z.object per parent.
    const nested: Record<string, Record<string, ZodTypeAny>> = {};
    // Required fields gated by a visibility dependency (e.g. "Firmenname" only
    // for Kundentyp=Firma) must not block submission while hidden – they are
    // validated conditionally after parsing instead.
    const conditionallyRequired: FieldDefinition[] = [];

    for (const field of action.fields) {
      if (field.hidden) continue;
      const hasDependency = (field.constraints ?? []).some((c) => c.type === "dependency" && c.condition);
      const gatedRequired = field.required && hasDependency;
      if (gatedRequired) conditionallyRequired.push(field);
      const schema = this.buildFieldSchema(field, gatedRequired);
      const dot = field.key.indexOf(".");
      if (dot === -1) {
        shape[field.key] = schema;
      } else {
        const parent = field.key.slice(0, dot);
        const child = field.key.slice(dot + 1);
        (nested[parent] ??= {})[child] = schema;
      }
    }

    for (const [parent, childShape] of Object.entries(nested)) {
      shape[parent] = z.object(childShape);
    }

    const base = z.object(shape);
    if (conditionallyRequired.length === 0) return base;

    return base.superRefine((data, ctx) => {
      for (const field of conditionallyRequired) {
        if (!this.evaluateVisibility(field, data as FormValues)) continue;
        const value = getValueAtPath(data as FormValues, field.key);
        if (value === null || value === undefined || value === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: field.key.split("."),
            message: `${field.label} ist erforderlich`,
          });
        }
      }
    });
  }

  private buildFieldSchema(field: FieldDefinition, forceOptional = false): ZodTypeAny {
    let schema: ZodTypeAny;

    switch (field.type) {
      case "email":
        schema = z.string().email("Ungültige E-Mail-Adresse");
        break;
      case "phone":
        schema = z.string().regex(/^[+\d\s\-()]*$/, "Ungültige Telefonnummer");
        break;
      case "number":
        schema = z.number({ coerce: true });
        break;
      case "checkbox":
        schema = z.boolean();
        break;
      case "date":
        schema = z.string().datetime({ offset: true }).or(z.string().date());
        break;
      case "datetime":
        schema = z.string().datetime({ offset: true });
        break;
      case "multi_select":
        schema = z.array(z.string());
        break;
      case "table_line_items":
        schema = z.array(z.record(z.unknown()));
        break;
      case "address_block":
        schema = z.object({
          street: z.string().min(1),
          zip: z.string().min(1),
          city: z.string().min(1),
          countryCode: z.string().length(2),
        });
        break;
      default:
        schema = z.string();
    }

    schema = this.applyConstraints(schema, field.constraints ?? []);

    if (!field.required || forceOptional) {
      schema = schema.optional().nullable();
    } else {
      if (field.type === "text" || field.type === "textarea") {
        schema = z.string().min(1, `${field.label} ist erforderlich`);
      }
    }

    return schema;
  }

  private applyConstraints(
    schema: ZodTypeAny,
    constraints: FieldConstraint[]
  ): ZodTypeAny {
    for (const constraint of constraints) {
      switch (constraint.type) {
        case "min":
          if (schema instanceof z.ZodString) {
            schema = (schema as z.ZodString).min(
              Number(constraint.value),
              constraint.message
            );
          } else if (schema instanceof z.ZodNumber) {
            schema = (schema as z.ZodNumber).min(
              Number(constraint.value),
              constraint.message
            );
          }
          break;
        case "max":
          if (schema instanceof z.ZodString) {
            schema = (schema as z.ZodString).max(
              Number(constraint.value),
              constraint.message
            );
          } else if (schema instanceof z.ZodNumber) {
            schema = (schema as z.ZodNumber).max(
              Number(constraint.value),
              constraint.message
            );
          }
          break;
        case "pattern":
          if (schema instanceof z.ZodString) {
            schema = (schema as z.ZodString).regex(
              new RegExp(String(constraint.value)),
              constraint.message
            );
          }
          break;
      }
    }
    return schema;
  }

  getInitialValues(action: ActionDefinition): FormValues {
    const values: FormValues = {};
    for (const field of action.fields) {
      let value: unknown;
      if (field.defaultValue !== undefined) {
        value = field.defaultValue;
      } else if (field.type === "multi_select" || field.type === "table_line_items") {
        value = [];
      } else if (field.type === "checkbox") {
        value = false;
      } else {
        value = null;
      }
      // Nest dotted keys ("address.street" → {address:{street}}) so the initial
      // values match the shape react-hook-form and the Zod schema use.
      const parts = field.key.split(".");
      if (parts.length === 1) {
        values[field.key] = value;
      } else {
        let cursor = values;
        for (let i = 0; i < parts.length - 1; i++) {
          const seg = parts[i]!;
          if (typeof cursor[seg] !== "object" || cursor[seg] === null) cursor[seg] = {};
          cursor = cursor[seg] as FormValues;
        }
        cursor[parts[parts.length - 1]!] = value;
      }
    }
    return values;
  }

  getVisibleFields(
    action: ActionDefinition,
    currentValues: FormValues
  ): FieldDefinition[] {
    return action.fields
      .filter((f) => !f.hidden)
      .filter((f) => this.evaluateVisibility(f, currentValues))
      .sort((a, b) => a.order - b.order);
  }

  private evaluateVisibility(
    field: FieldDefinition,
    values: FormValues
  ): boolean {
    if (!field.constraints) return true;
    const depConstraint = field.constraints.find((c) => c.type === "dependency");
    if (!depConstraint?.condition) return true;

    const { fieldId, operator, value } = depConstraint.condition;
    const fieldValue = values[fieldId];

    switch (operator) {
      case "eq": return fieldValue === value;
      case "neq": return fieldValue !== value;
      case "exists": return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
      case "notExists": return fieldValue === null || fieldValue === undefined || fieldValue === "";
      case "in": return Array.isArray(value) && value.includes(fieldValue);
      case "notIn": return Array.isArray(value) && !value.includes(fieldValue);
      default: return true;
    }
  }
}

/** Reads a (possibly dotted) key from nested form values. */
function getValueAtPath(values: FormValues, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, values);
}

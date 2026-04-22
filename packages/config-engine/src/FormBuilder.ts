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
  buildZodSchema(action: ActionDefinition): z.ZodObject<Record<string, ZodTypeAny>> {
    const shape: Record<string, ZodTypeAny> = {};

    for (const field of action.fields) {
      if (field.hidden) continue;
      shape[field.key] = this.buildFieldSchema(field);
    }

    return z.object(shape);
  }

  private buildFieldSchema(field: FieldDefinition): ZodTypeAny {
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

    if (!field.required) {
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
      if (field.defaultValue !== undefined) {
        values[field.key] = field.defaultValue;
      } else if (field.type === "multi_select" || field.type === "table_line_items") {
        values[field.key] = [];
      } else if (field.type === "checkbox") {
        values[field.key] = false;
      } else {
        values[field.key] = null;
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

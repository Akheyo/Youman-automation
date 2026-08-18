import { useFormContext, useWatch } from "react-hook-form";
import { FormBuilder } from "@youman/config-engine";
import { TextFieldRenderer } from "./fields/TextFieldRenderer";
import { SearchableSelectRenderer } from "./fields/SearchableSelectRenderer";
import { DropdownRenderer } from "./fields/DropdownRenderer";
import { LineItemsRenderer } from "./fields/LineItemsRenderer";
import { DateFieldRenderer } from "./fields/DateFieldRenderer";
import { CheckboxRenderer } from "./fields/CheckboxRenderer";
import { PrefilledTextRenderer } from "./fields/PrefilledTextRenderer";
import type { ActionDefinition, FieldDefinition } from "@youman/shared";
import { cn } from "@/utils/cn";

const formBuilder = new FormBuilder();

interface ActionFormRendererProps {
  action: ActionDefinition;
  isLoading?: boolean | undefined;
}

export function ActionFormRenderer({ action, isLoading }: ActionFormRendererProps) {
  const { getValues } = useFormContext();
  const values = useWatch();
  const currentValues = { ...getValues(), ...values };

  const visibleFields = formBuilder.getVisibleFields(action, currentValues as Record<string, unknown>);

  const fieldGroups = action.fieldGroups ?? [];
  const ungrouped = visibleFields.filter((f) => !f.groupId);
  const grouped = fieldGroups.map((group) => ({
    group,
    fields: visibleFields.filter((f) => f.groupId === group.id),
  })).filter((g) => g.fields.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map(({ group, fields }) => (
        <fieldset key={group.id} className="border border-border rounded-lg p-4 space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">
            {group.label}
          </legend>
          <FieldGrid fields={fields} isLoading={isLoading} />
        </fieldset>
      ))}
      {ungrouped.length > 0 && (
        <FieldGrid fields={ungrouped} isLoading={isLoading} />
      )}
    </div>
  );
}

function FieldGrid({ fields, isLoading }: { fields: FieldDefinition[]; isLoading?: boolean | undefined }) {
  return (
    <div className="grid grid-cols-6 gap-4">
      {fields.map((field) => (
        <div
          key={field.id}
          className={cn(
            field.width === "third" ? "col-span-2" :
            field.width === "half" ? "col-span-3" : "col-span-6"
          )}
        >
          <FieldRenderer field={field} isLoading={isLoading} />
        </div>
      ))}
    </div>
  );
}

function FieldRenderer({ field, isLoading }: { field: FieldDefinition; isLoading?: boolean | undefined }) {
  const props = { field, disabled: isLoading };

  switch (field.type) {
    case "searchable_select":
    case "dynamic_dropdown":
      return <SearchableSelectRenderer {...props} />;
    case "dropdown":
      return <DropdownRenderer {...props} />;
    case "table_line_items":
      return <LineItemsRenderer {...props} />;
    case "date":
    case "datetime":
      return <DateFieldRenderer {...props} />;
    case "checkbox":
      return <CheckboxRenderer {...props} />;
    case "textarea":
      // Mit Endpunkt belegt sich das Feld aus dem ERP vor und bleibt bearbeitbar.
      return field.dynamicSource
        ? <PrefilledTextRenderer {...props} />
        : <TextFieldRenderer {...props} />;
    default:
      return <TextFieldRenderer {...props} />;
  }
}

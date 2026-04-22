import { useFormContext } from "react-hook-form";
import type { FieldDefinition } from "@youman/shared";

interface Props { field: FieldDefinition; disabled?: boolean }

export function CheckboxRenderer({ field, disabled }: Props) {
  const { register } = useFormContext();

  return (
    <div className="flex items-center gap-2.5 py-2">
      <input
        type="checkbox"
        id={field.id}
        disabled={disabled}
        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
        {...register(field.key)}
      />
      <label htmlFor={field.id} className="text-sm font-medium text-foreground cursor-pointer">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
    </div>
  );
}

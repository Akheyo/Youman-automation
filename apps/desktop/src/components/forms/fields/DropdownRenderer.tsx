import { useFormContext } from "react-hook-form";
import { cn } from "@/utils/cn";
import type { FieldDefinition } from "@youman/shared";
import { fieldErrorMessage } from "@/utils/formErrors";

interface Props { field: FieldDefinition; disabled?: boolean }

export function DropdownRenderer({ field, disabled }: Props) {
  const { register, formState: { errors } } = useFormContext();
  const error = fieldErrorMessage(errors, field.key);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <select
        {...register(field.key)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-destructive"
        )}
      >
        {!field.required && <option value="">-- Bitte wählen --</option>}
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

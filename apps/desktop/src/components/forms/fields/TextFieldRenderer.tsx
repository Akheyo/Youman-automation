import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { FieldDefinition } from "@youman/shared";

interface Props { field: FieldDefinition; disabled?: boolean }

export function TextFieldRenderer({ field, disabled }: Props) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[field.key]?.message as string | undefined;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          {...register(field.key)}
          disabled={disabled}
          placeholder={field.placeholder}
          rows={3}
          className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 selectable resize-none"
        />
      ) : (
        <Input
          {...register(field.key, {
            valueAsNumber: field.type === "number",
          })}
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          placeholder={field.placeholder}
          disabled={disabled}
          error={error}
          step={field.type === "number" ? "any" : undefined}
        />
      )}
      {error && field.type === "textarea" && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {field.description && !error && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

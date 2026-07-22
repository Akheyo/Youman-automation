import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import type { FieldDefinition } from "@youman/shared";
import { fieldErrorMessage } from "@/utils/formErrors";

interface Props { field: FieldDefinition; disabled?: boolean }

export function DateFieldRenderer({ field, disabled }: Props) {
  const { register, formState: { errors } } = useFormContext();
  const error = fieldErrorMessage(errors, field.key);
  const inputType = field.type === "datetime" ? "datetime-local" : "date";

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Input
        type={inputType}
        icon={<Calendar className="h-4 w-4" />}
        disabled={disabled}
        error={error}
        {...register(field.key)}
      />
    </div>
  );
}

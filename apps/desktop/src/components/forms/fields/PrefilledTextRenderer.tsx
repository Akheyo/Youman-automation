import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/services/api";
import type { FieldDefinition } from "@youman/shared";
import { fieldErrorMessage } from "@/utils/formErrors";
import { extractTemplateParams, resolveEndpoint } from "./dynamicSource";

interface Props { field: FieldDefinition; disabled?: boolean | undefined }

interface Option { id: string; [key: string]: unknown }

/**
 * Mehrzeiliges Textfeld, das sich aus einem Endpunkt vorbelegt und danach frei
 * bearbeitbar bleibt – für die Lieferanschrift eines Angebots.
 *
 * Vorbelegt wird nur beim Wechsel des Bezugsfeldes (also des Kunden). Ein
 * Vorbelegen bei jedem Rendern würde eigene Eingaben wieder überschreiben, und
 * ein Vorbelegen nur bei leerem Feld ließe den Text nach dem Löschen sofort
 * zurückkehren.
 *
 * Hat der Kunde mehrere Anschriften, steht darüber eine Auswahl, die die
 * gewählte in das Feld schreibt. Ohne sie käme man an die übrigen Anschriften
 * des Kundenstamms nicht mehr heran.
 */
export function PrefilledTextRenderer({ field, disabled }: Props) {
  const { register, setValue, formState: { errors } } = useFormContext();
  const currentValue = useWatch({ name: field.key }) as string | undefined;
  const error = fieldErrorMessage(errors, field.key);

  const source = field.dynamicSource;
  const textField = source?.labelField ?? "label";

  const templateParams = source ? extractTemplateParams(source.endpoint) : [];
  const watched = useWatch({
    name: templateParams.length > 0 ? templateParams : ["__placeholder__"],
  }) as unknown[];
  const depValues: Record<string, string> = Object.fromEntries(
    templateParams.map((key, i) => [key, String(watched[i] ?? "")])
  );
  const resolved = templateParams.every((k) => !!depValues[k]);
  const endpoint = source ? resolveEndpoint(source.endpoint, depValues) : "";
  const depKey = templateParams.map((k) => depValues[k]).join("|");

  const { data, isFetching } = useQuery({
    queryKey: ["field-prefill", field.id, endpoint],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Option[] }>(endpoint, {
        params: { pageSize: source?.pageSize ?? 20 },
      });
      return res.data?.items ?? [];
    },
    enabled: !!source && resolved,
    staleTime: 15_000,
  });

  const options = data ?? [];
  const textOf = (option: Option): string => String(option[textField] ?? "");

  // Beim Weiterarbeiten an einem Angebot steht der Text bereits. Er gilt dann
  // als für diesen Kunden gesetzt und wird nicht überschrieben.
  const filledFor = useRef<string | null>(currentValue?.trim() ? depKey : null);

  useEffect(() => {
    if (options.length === 0) return;
    if (filledFor.current === depKey) return;
    filledFor.current = depKey;
    setValue(field.key, textOf(options[0]!), { shouldValidate: true, shouldDirty: true });
    // textOf und setValue sind über den Renderlauf stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, depKey, field.key]);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
        {isFetching && <Loader2 className="inline h-3.5 w-3.5 ml-2 animate-spin text-muted-foreground" />}
      </label>

      {options.length > 1 && (
        <select
          disabled={disabled}
          value=""
          onChange={(e) => {
            const picked = options.find((o) => String(o.id) === e.target.value);
            if (picked) setValue(field.key, textOf(picked), { shouldValidate: true, shouldDirty: true });
          }}
          className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">Andere Anschrift aus dem Kundenstamm übernehmen…</option>
          {options.map((option) => (
            <option key={String(option.id)} value={String(option.id)}>
              {String(option[source?.descriptionField ?? "description"] ?? "")}
              {" – "}
              {textOf(option).replace(/\n/g, ", ")}
            </option>
          ))}
        </select>
      )}

      <textarea
        {...register(field.key)}
        disabled={disabled}
        placeholder={field.placeholder}
        rows={3}
        className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 selectable resize-none"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      {field.description && !error && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

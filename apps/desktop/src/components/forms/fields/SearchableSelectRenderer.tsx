import { useState, useCallback, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, X, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/services/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import type { FieldDefinition, Customer, Product } from "@youman/shared";
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_CHARS } from "@youman/shared";

type SearchItem = Customer | Product | { id: string; [key: string]: unknown };

interface Props { field: FieldDefinition; disabled?: boolean }

// Replace {paramName} tokens in endpoint URLs with actual form values.
function resolveEndpoint(endpoint: string, values: Record<string, string>): string {
  return endpoint.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

// Extract all {paramName} tokens from a URL template.
function extractTemplateParams(endpoint: string): string[] {
  return [...endpoint.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

export function SearchableSelectRenderer({ field, disabled }: Props) {
  const { setValue, formState: { errors } } = useFormContext();
  const currentValue = useWatch({ name: field.key });
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const source = field.dynamicSource;
  const error = errors[field.key]?.message as string | undefined;
  const isDynamic = field.type === "dynamic_dropdown";

  // Resolve URL template params from form values
  const templateParams = source ? extractTemplateParams(source.endpoint) : [];
  const watchedParamValues = useWatch({ name: templateParams.length > 0 ? templateParams : ["__placeholder__"] }) as unknown[];
  const depValues: Record<string, string> = Object.fromEntries(
    templateParams.map((key, i) => [key, String(watchedParamValues[i] ?? "")])
  );
  const allParamsResolved = templateParams.every((k) => !!depValues[k]);
  const resolvedEndpoint = source ? resolveEndpoint(source.endpoint, depValues) : "";

  const minChars = source?.minChars ?? (isDynamic ? 0 : MIN_SEARCH_CHARS);

  const { data, isFetching } = useQuery({
    queryKey: ["field-search", field.id, resolvedEndpoint, query],
    queryFn: async () => {
      if (!source) return { items: [] };
      if (!allParamsResolved) return { items: [] };
      if (query.length < minChars) return { items: [] };
      const params: Record<string, unknown> = { pageSize: source.pageSize ?? 20 };
      if (query) params[source.searchParam] = query;
      const res = await apiClient.get<{ items: SearchItem[] }>(resolvedEndpoint, { params });
      return res.data as { items: SearchItem[] };
    },
    enabled: allParamsResolved && (isDynamic ? true : isOpen && query.length >= minChars),
    staleTime: 15_000,
  });

  const items = data?.items ?? [];

  const handleSearch = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(val), source?.debounceMs ?? SEARCH_DEBOUNCE_MS);
  }, [source?.debounceMs]);

  const handleSelect = (item: SearchItem) => {
    const valueField = source?.valueField ?? "id";
    const labelField = source?.labelField ?? "name";
    setValue(field.key, item[valueField] as string, { shouldValidate: true });
    setSelectedLabel(item[labelField] as string ?? "");
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    setValue(field.key, null, { shouldValidate: true });
    setSelectedLabel("");
    setQuery("");
  };

  // Navigate to the inline-creation action for known search endpoints
  const handleCreateNew = () => {
    const creationActionMap: Record<string, string> = {
      "/api/v1/search/customers": "action-create-customer",
      "/api/v1/search/products": "action-create-product",
    };
    const createActionId = source?.endpoint ? creationActionMap[source.endpoint] : undefined;
    if (createActionId) {
      navigate(`/action/${createActionId}`, { state: { returnTo: window.location.hash } });
    }
  };

  // dynamic_dropdown: render as a select-style dropdown, not a search input
  if (isDynamic) {
    const depMissing = !allParamsResolved;
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </label>

        <div className="relative">
          <button
            type="button"
            disabled={disabled || depMissing}
            onClick={() => !depMissing && setIsOpen((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-input text-sm text-left transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              (disabled || depMissing) && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className={cn("flex-1 truncate", currentValue ? "text-foreground" : "text-muted-foreground")}>
              {currentValue
                ? (selectedLabel || String(currentValue))
                : depMissing
                ? "Erst Kunde auswählen..."
                : field.placeholder ?? `${field.label} auswählen`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {currentValue && !disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleClear(); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>

          {isOpen && !disabled && !depMissing && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
                {items.length > 0 ? (
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {items.map((item) => {
                      const valueField = source?.valueField ?? "id";
                      const labelField = source?.labelField ?? "name";
                      const descField = source?.descriptionField;
                      return (
                        <li key={item[valueField] as string}>
                          <button
                            type="button"
                            className="w-full flex flex-col px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                            onClick={() => handleSelect(item)}
                          >
                            <span className="font-medium text-foreground">{item[labelField] as string}</span>
                            {descField && (
                              <span className="text-xs text-muted-foreground">{item[descField] as string}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : isFetching ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">Lade...</div>
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">Keine Einträge gefunden</div>
                )}
              </div>
            </>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      </div>
    );
  }

  // searchable_select: search-input style
  return (
    <div className="space-y-1.5 relative">
      <label className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>

      {currentValue && !isOpen ? (
        <div className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-input text-sm",
          disabled && "opacity-50"
        )}>
          <span className="flex-1 truncate text-foreground">{selectedLabel || String(currentValue)}</span>
          {!disabled && (
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {!disabled && (
            <button type="button" onClick={() => setIsOpen(true)} className="text-muted-foreground hover:text-foreground shrink-0">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Input
            icon={<Search className="h-3.5 w-3.5" />}
            placeholder={field.placeholder ?? `${field.label} suchen...`}
            disabled={disabled}
            onChange={(e) => {
              handleSearch(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            autoComplete="off"
            error={error}
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
            {items.length > 0 ? (
              <ul className="max-h-56 overflow-y-auto py-1">
                {items.map((item) => {
                  const valueField = source?.valueField ?? "id";
                  const labelField = source?.labelField ?? "name";
                  const descField = source?.descriptionField;
                  return (
                    <li key={item[valueField] as string}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
                        onClick={() => handleSelect(item)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{item[labelField] as string}</p>
                          {descField && (
                            <p className="text-xs text-muted-foreground truncate">{item[descField] as string}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : query.length >= minChars && !isFetching ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">Keine Ergebnisse für „{query}"</p>
              </div>
            ) : (
              <div className="px-3 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {query.length < minChars
                    ? `Mindestens ${minChars} Zeichen eingeben...`
                    : "Suchen..."}
                </p>
              </div>
            )}

            {/* Inline creation — only for known search types */}
            {source && (source.endpoint === "/api/v1/search/customers" || source.endpoint === "/api/v1/search/products") && (
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Neu anlegen</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

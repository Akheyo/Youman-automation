import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2, Search, Loader2 } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/services/api";
import { cn } from "@/utils/cn";
import type { FieldDefinition, Product } from "@youman/shared";

interface Props { field: FieldDefinition; disabled?: boolean }

export function LineItemsRenderer({ field, disabled }: Props) {
  const { control, register, setValue, watch, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: field.key });
  const columns = field.lineItemColumns ?? [];
  const errorMsg = (errors[field.key] as { message?: string } | undefined)?.message;

  const addLine = () => {
    // Menge startet bei 1 – 0 wäre nie eine gültige Position.
    const empty = Object.fromEntries(
      columns.map((col) => [col.key, col.type === "number" ? (col.key === "quantity" ? 1 : 0) : ""])
    );
    append(empty);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </label>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Position hinzufügen
          </Button>
        )}
      </div>

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid bg-secondary/50" style={{ gridTemplateColumns: `${columns.map((c) => `${c.width ?? 120}px`).join(" ")} 36px` }}>
          {columns.map((col) => (
            <div key={col.key} className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {col.label}
              {col.required && <span className="text-destructive ml-0.5">*</span>}
            </div>
          ))}
          <div />
        </div>

        {/* Rows */}
        {fields.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border-t border-border">
            Noch keine Positionen. Klicken Sie auf "Position hinzufügen".
          </div>
        ) : (
          fields.map((item, rowIdx) => (
            <div
              key={item.id}
              className="grid border-t border-border items-center"
              style={{ gridTemplateColumns: `${columns.map((c) => `${c.width ?? 120}px`).join(" ")} 36px` }}
            >
              {columns.map((col) => (
                <div key={col.key} className="px-1 py-1">
                  {col.type === "searchable_select" ? (
                    <ProductSearchCell
                      fieldKey={`${field.key}.${rowIdx}.${col.key}`}
                      col={col}
                      disabled={disabled}
                      rowIdx={rowIdx}
                      fieldKey2={field.key}
                      setValue={setValue}
                      watch={watch}
                    />
                  ) : (
                    <input
                      {...register(`${field.key}.${rowIdx}.${col.key}`, {
                        valueAsNumber: col.type === "number",
                      })}
                      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                      step={col.type === "number" ? "any" : undefined}
                      disabled={disabled}
                      className={cn(
                        "w-full h-8 rounded border border-transparent bg-transparent px-2 text-sm text-foreground",
                        "focus:border-input focus:bg-input focus:outline-none focus:ring-1 focus:ring-ring",
                        "placeholder:text-muted-foreground selectable"
                      )}
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-center">
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(rowIdx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProductSearchCell({
  fieldKey,
  col,
  disabled,
  rowIdx,
  fieldKey2,
  setValue,
  watch,
}: {
  fieldKey: string;
  col: NonNullable<FieldDefinition["lineItemColumns"]>[number];
  disabled?: boolean;
  rowIdx: number;
  fieldKey2: string;
  setValue: ReturnType<typeof useFormContext>["setValue"];
  watch: ReturnType<typeof useFormContext>["watch"];
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // The table wrapper uses overflow-hidden (rounded corners), which clips any
  // absolutely positioned dropdown – so the panel is rendered into a portal
  // at a fixed position derived from the input's viewport rect.
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const source = col.dynamicSource;
  const currentValue = watch(fieldKey) as string;
  const [label, setLabel] = useState("");

  const openDropdown = () => {
    setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null);
    setIsOpen(true);
  };

  const { data, isFetching } = useQuery({
    queryKey: ["line-item-search", col.key, query],
    queryFn: async () => {
      if (!source || query.length < (source.minChars ?? 2)) return { items: [] };
      const res = await apiClient.get<{ items: Product[] }>(source.endpoint, {
        params: { [source.searchParam]: query, pageSize: 20 },
      });
      return res.data as { items: Product[] };
    },
    enabled: isOpen && query.length >= (source?.minChars ?? 2),
  });

  const items = data?.items ?? [];

  const handleSearch = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(val), source?.debounceMs ?? 300);
  }, [source?.debounceMs]);

  const handleSelect = (item: Product) => {
    setValue(fieldKey, item.id, { shouldValidate: true });
    setValue(`${fieldKey2}.${rowIdx}.articleNumber`, item.articleNumber);
    setValue(`${fieldKey2}.${rowIdx}.designation`, item.designation);
    setValue(`${fieldKey2}.${rowIdx}.unit`, item.unit);
    setValue(`${fieldKey2}.${rowIdx}.pricePerUnit`, item.basePrice);
    setLabel(item.designation);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={anchorRef}>
      {currentValue && !isOpen ? (
        <div
          className="w-full h-8 px-2 text-sm text-foreground truncate flex items-center cursor-pointer hover:bg-input rounded"
          onClick={() => !disabled && openDropdown()}
          title={label}
        >
          {label || currentValue}
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder="Artikel suchen..."
            disabled={disabled}
            onChange={(e) => { handleSearch(e.target.value); openDropdown(); }}
            onFocus={openDropdown}
            className="w-full h-8 pl-6 pr-2 rounded border border-transparent bg-transparent text-sm text-foreground focus:border-input focus:bg-input focus:outline-none focus:ring-1 focus:ring-ring selectable placeholder:text-muted-foreground"
            autoComplete="off"
          />
          <Search className="absolute left-1.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          {isFetching && <Loader2 className="absolute right-1.5 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      )}

      {isOpen && !disabled && anchorRect && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-50 w-72 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
            style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
          >
            {items.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto py-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-xs hover:bg-secondary text-left transition-colors"
                      onClick={() => handleSelect(item)}
                    >
                      <p className="font-medium text-foreground truncate">{item.designation}</p>
                      <p className="text-muted-foreground">{item.articleNumber} · {(item.basePrice ?? 0).toFixed(2)} {item.currency ?? "EUR"}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                {query.length < 2 ? "Mindestens 2 Zeichen eingeben..." : isFetching ? "Suche..." : "Keine Ergebnisse"}
              </p>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calculator, ArrowLeft, Plus, Trash2, Save, Loader2, FileText, TrendingDown, TrendingUp, Percent,
} from "lucide-react";
import { apiClient, getApiError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import {
  calculateCostTotals,
  type CostAnalysis,
  type CostItem,
  type CostItemType,
} from "@youman/shared";

type EditorState = { id: string | null; draft: DraftAnalysis } | null;

interface DraftAnalysis {
  title: string;
  description: string;
  currency: string;
  items: CostItem[];
}

const EMPTY_DRAFT: DraftAnalysis = {
  title: "Neue Kostenanalyse",
  description: "",
  currency: "EUR",
  items: [],
};

/**
 * Kostenanalyse — scenario calculator. Users add cost items (each: label,
 * unit cost × quantity) and offsetting savings items. The screen renders a
 * live-updating total: costs − savings = net effect. Analyses are persisted
 * per tenant so they can be re-opened, edited, and compared later.
 */
export function CostAnalysisScreen() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState>(null);

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["cost-analyses"],
    queryFn: async () => {
      const res = await apiClient.get<CostAnalysis[]>("/cost-analyses");
      return res.data;
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: DraftAnalysis }) => {
      const payload = {
        title: draft.title.trim() || "Ohne Titel",
        description: draft.description,
        currency: draft.currency,
        items: draft.items,
      };
      const res = id
        ? await apiClient.put<CostAnalysis>(`/cost-analyses/${id}`, payload)
        : await apiClient.post<CostAnalysis>("/cost-analyses", payload);
      return res.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["cost-analyses"] });
      toast({ title: "Kostenanalyse gespeichert", variant: "success" });
      setEditor({ id: saved.id, draft: toDraft(saved) });
    },
    onError: (err) => {
      toast({ title: "Fehler beim Speichern", description: getApiError(err), variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/cost-analyses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-analyses"] });
      toast({ title: "Kostenanalyse gelöscht", variant: "info" });
      setEditor(null);
    },
    onError: (err) => {
      toast({ title: "Löschen fehlgeschlagen", description: getApiError(err), variant: "error" });
    },
  });

  if (editor) {
    const editorId = editor.id;
    return (
      <CostAnalysisEditor
        state={editor}
        onChange={(draft) => setEditor({ ...editor, draft })}
        onBack={() => setEditor(null)}
        onSave={() => saveMutation.mutate(editor)}
        {...(editorId ? { onDelete: () => deleteMutation.mutate(editorId) } : {})}
        saving={saveMutation.isPending}
        deleting={deleteMutation.isPending}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pt-8 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kostenanalyse</h1>
            <p className="text-sm text-muted-foreground">
              Kosten und Einsparungen gegenüberstellen, Netto-Effekt sofort sichtbar.
            </p>
          </div>
        </div>
        <Button onClick={() => setEditor({ id: null, draft: { ...EMPTY_DRAFT, items: [] } })}>
          <Plus className="h-4 w-4" /> Neue Analyse
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade…
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center space-y-3">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Noch keine Analysen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Beispiel: 5 zusätzliche LKW × 45.000 € gegen 12.000 € Palettenrabatt.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setEditor({ id: null, draft: { ...EMPTY_DRAFT, items: [] } })}
          >
            <Plus className="h-4 w-4" /> Erste Analyse anlegen
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {analyses.map((a) => {
            const totals = calculateCostTotals(a.items);
            return (
              <button
                key={a.id}
                onClick={() => setEditor({ id: a.id, draft: toDraft(a) })}
                className="text-left rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                    {a.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {a.items.length} Positionen · Zuletzt aktualisiert{" "}
                      {new Date(a.updatedAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Netto-Effekt</p>
                    <p
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        totals.netEffect > 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {formatCurrency(totals.netEffect, a.currency)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Editor ────────────────────────────────────────────────────────────────────

interface EditorProps {
  state: NonNullable<EditorState>;
  onChange: (draft: DraftAnalysis) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete?: () => void;
  saving: boolean;
  deleting: boolean;
}

function CostAnalysisEditor({
  state, onChange, onBack, onSave, onDelete, saving, deleting,
}: EditorProps) {
  const { draft } = state;
  const totals = useMemo(() => calculateCostTotals(draft.items), [draft.items]);

  const patch = (partial: Partial<DraftAnalysis>) => onChange({ ...draft, ...partial });

  const updateItem = (id: string, partial: Partial<CostItem>) => {
    patch({ items: draft.items.map((it) => (it.id === id ? { ...it, ...partial } : it)) });
  };

  const addItem = (type: CostItemType) => {
    const newItem: CostItem = {
      id: newId(),
      label: type === "cost" ? "Neue Kostenposition" : "Neue Einsparung",
      unitCost: 0,
      quantity: 1,
      type,
    };
    patch({ items: [...draft.items, newItem] });
  };

  const removeItem = (id: string) => {
    patch({ items: draft.items.filter((it) => it.id !== id) });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6 pb-40 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon-sm" onClick={onBack} title="Zurück">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Kostenanalyse</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {state.id ? "Bearbeiten" : "Neu"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" /> Löschen
            </Button>
          )}
          <Button onClick={onSave} loading={saving}>
            <Save className="h-4 w-4" /> Speichern
          </Button>
        </div>
      </div>

      {/* Meta card */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Titel
          </label>
          <Input
            className="mt-1"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="z.B. Flotte-Erweiterung Q3"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Beschreibung (optional)
          </label>
          <textarea
            className="mt-1 flex min-h-[70px] w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Kontext, Annahmen, Zeithorizont …"
          />
        </div>
      </div>

      {/* Items */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Positionen</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => addItem("cost")}>
              <Plus className="h-3.5 w-3.5" /> Kosten
            </Button>
            <Button variant="outline" size="sm" onClick={() => addItem("saving")}>
              <Plus className="h-3.5 w-3.5" /> Einsparung
            </Button>
          </div>
        </div>

        {draft.items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Noch keine Positionen. Beispiel: 5 zusätzliche LKW × 45.000 € — dagegen 12.000 € Rabatt durch Palettenbündelung.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {draft.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                currency={draft.currency}
                onChange={(partial) => updateItem(item.id, partial)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Live totals */}
      <TotalsPanel totals={totals} currency={draft.currency} />
    </div>
  );
}

// ─── Item row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: CostItem;
  currency: string;
  onChange: (partial: Partial<CostItem>) => void;
  onRemove: () => void;
}

function ItemRow({ item, currency, onChange, onRemove }: ItemRowProps) {
  const lineTotal = item.unitCost * item.quantity;
  const isSaving = item.type === "saving";

  return (
    <div className={cn(
      "px-4 py-3 grid grid-cols-12 gap-3 items-start",
      isSaving && "bg-success/5",
    )}>
      <div className="col-span-1 flex items-center justify-center pt-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full",
            isSaving ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
          )}
          title={isSaving ? "Einsparung" : "Kosten"}
        >
          {isSaving ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
        </span>
      </div>

      <div className="col-span-4">
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Bezeichnung</label>
        <Input
          className="mt-0.5"
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={isSaving ? "z.B. Rabatt Palettenkauf" : "z.B. LKW zusätzlich"}
        />
        <Input
          className="mt-2 text-xs"
          value={item.category ?? ""}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="Kategorie (optional)"
        />
      </div>

      <div className="col-span-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Menge</label>
        <Input
          className="mt-0.5 text-right tabular-nums"
          type="number"
          min={0}
          step="0.01"
          value={item.quantity}
          onChange={(e) => onChange({ quantity: numOrZero(e.target.value) })}
        />
      </div>

      <div className="col-span-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Stückkosten</label>
        <Input
          className="mt-0.5 text-right tabular-nums"
          type="number"
          min={0}
          step="0.01"
          value={item.unitCost}
          onChange={(e) => onChange({ unitCost: numOrZero(e.target.value) })}
        />
      </div>

      <div className="col-span-2 text-right">
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Zeilensumme</label>
        <p
          className={cn(
            "mt-2 text-sm font-semibold tabular-nums",
            isSaving ? "text-success" : "text-foreground",
          )}
        >
          {isSaving ? "−" : ""}
          {formatCurrency(lineTotal, currency)}
        </p>
      </div>

      <div className="col-span-1 flex items-start justify-end pt-4">
        <Button variant="ghost" size="icon-sm" onClick={onRemove} title="Position entfernen">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Totals ────────────────────────────────────────────────────────────────────

function TotalsPanel({
  totals, currency,
}: { totals: ReturnType<typeof calculateCostTotals>; currency: string }) {
  const savingsRatio = totals.totalCosts > 0 ? totals.totalSavings / totals.totalCosts : 0;
  const isNetSaving = totals.netEffect < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <StatCard
        icon={<TrendingUp className="h-4 w-4 text-destructive" />}
        label="Zusatzkosten"
        value={formatCurrency(totals.totalCosts, currency)}
        tone="cost"
      />
      <StatCard
        icon={<TrendingDown className="h-4 w-4 text-success" />}
        label="Einsparungen"
        value={formatCurrency(totals.totalSavings, currency)}
        tone="saving"
      />
      <StatCard
        icon={<Percent className="h-4 w-4 text-primary" />}
        label="Einspar-Quote"
        value={`${(savingsRatio * 100).toFixed(1)}%`}
        tone="neutral"
      />
      <StatCard
        icon={<Calculator className="h-4 w-4 text-foreground" />}
        label={isNetSaving ? "Netto-Einsparung" : "Netto-Effekt"}
        value={formatCurrency(Math.abs(totals.netEffect), currency)}
        tone={isNetSaving ? "saving" : "cost"}
        highlight
      />
    </div>
  );
}

function StatCard({
  icon, label, value, tone, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "cost" | "saving" | "neutral";
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 bg-card",
        highlight && "border-2",
        highlight && tone === "cost" && "border-destructive/40 bg-destructive/5",
        highlight && tone === "saving" && "border-success/40 bg-success/5",
        !highlight && "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p
        className={cn(
          "mt-2 text-xl font-bold tabular-nums",
          tone === "cost" && "text-destructive",
          tone === "saving" && "text-success",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDraft(a: CostAnalysis): DraftAnalysis {
  return {
    title: a.title,
    description: a.description ?? "",
    currency: a.currency ?? "EUR",
    items: a.items ?? [],
  };
}

function numOrZero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function newId(): string {
  return `it_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

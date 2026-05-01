import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, WifiOff, Loader2 } from "lucide-react";
import { FormBuilder } from "@youman/config-engine";
import { apiClient } from "@/services/api";
import { syncService } from "@/services/syncService";
import { useAuthStore } from "@/stores/authStore";
import { useOfflineStore } from "@/stores/offlineStore";
import { ActionFormRenderer } from "@/components/forms/ActionFormRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import { getApiError } from "@/services/api";
import { cn } from "@/utils/cn";
import type { ActionDefinition, ActionExecution } from "@youman/shared";

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Vertrieb",
  crm: "CRM",
  inventory: "Lager",
  purchasing: "Einkauf",
  administration: "Administration",
  logistics: "Logistik",
};

const formBuilder = new FormBuilder();

export function DashboardScreen() {
  const { user } = useAuthStore();
  const { isOnline } = useOfflineStore();
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["actions", "definitions"],
    queryFn: async () => {
      const res = await apiClient.get<ActionDefinition[]>("/actions/definitions");
      return res.data as unknown as ActionDefinition[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const available = actions.filter(
    (a) => a.enabled && a.allowedRoles.includes(user?.role ?? "VIEWER")
  );

  const grouped = available.reduce<Record<string, ActionDefinition[]>>((acc, a) => {
    const cat = a.category.toLowerCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(a);
    return acc;
  }, {});

  const selectedAction = available.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-24 space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Guten Tag, {user?.firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wählen Sie eine Aktion aus, um zu beginnen.
          </p>
        </div>

        {/* Action selector */}
        {isLoading ? (
          <div className="h-11 rounded-lg bg-muted animate-pulse" />
        ) : (
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={cn(
                "w-full h-11 appearance-none rounded-lg border border-input bg-card px-4 pr-10",
                "text-sm font-medium text-foreground shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
                "cursor-pointer transition-colors",
                !selectedId && "text-muted-foreground"
              )}
            >
              <option value="" disabled>Aktion auswählen...</option>
              {Object.entries(grouped).map(([category, acts]) => (
                <optgroup key={category} label={CATEGORY_LABELS[category] ?? category}>
                  {acts.map((a) => (
                    <option
                      key={a.id}
                      value={a.id}
                      disabled={!isOnline && a.offlineBehavior === "reject"}
                    >
                      {a.displayName}
                      {!isOnline && a.offlineBehavior === "queue" ? " (Offline)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Inline form */}
        {selectedAction && (
          <ActionForm
            key={selectedAction.id}
            action={selectedAction}
            isOnline={isOnline}
            onDone={() => setSelectedId("")}
          />
        )}

      </div>
    </div>
  );
}

interface ActionFormProps {
  action: ActionDefinition;
  isOnline: boolean;
  onDone: () => void;
}

function ActionForm({ action, isOnline, onDone }: ActionFormProps) {
  const navigate = useNavigate();
  const schema = formBuilder.buildZodSchema(action);
  const initialValues = formBuilder.getInitialValues(action);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  const executeMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!isOnline && action.offlineBehavior === "queue") {
        const queued = await syncService.enqueueOffline({
          actionId: action.id,
          actionName: action.displayName,
          payload,
        });
        if (!queued) throw new Error("Offline-Queue nicht verfügbar");
        return { status: "queued_offline" } as unknown as ActionExecution;
      }

      const res = await apiClient.post<ActionExecution>("/actions/execute", {
        actionId: action.id,
        payload,
        clientTimestamp: new Date().toISOString(),
      });
      return res.data;
    },

    onSuccess: async (result) => {
      if ((result as unknown as { status: string }).status === "queued_offline") {
        toast({
          title: "Gespeichert",
          description: "Wird nach Wiederherstellung der Verbindung ausgeführt.",
          variant: "warning",
        });
        onDone();
        return;
      }

      for (const sa of action.successActions) {
        if (sa.type === "open_pdf") {
          const url = (result.result as Record<string, string> | null)?.[sa.config["urlField"] as string];
          if (url && window.adept) await window.adept.pdf.open(url);
        }
        if (sa.type === "prepare_email") {
          const qn = (result.result as Record<string, string> | null)?.["erpQuoteNumber"] ?? "";
          const subject = String(sa.config["subject"] ?? "").replace("{quoteNumber}", qn);
          const body = String(sa.config["body"] ?? "").replace("{quoteNumber}", qn);
          if (window.adept) await window.adept.app.openExternal(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        }
      }

      toast({ title: "Erfolgreich", description: `${action.displayName} ausgeführt.`, variant: "success" });
      onDone();
    },

    onError: (err) => {
      toast({ title: "Fehler", description: getApiError(err), variant: "error" });
    },
  });

  const onSubmit = methods.handleSubmit(
    (data) => {
      executeMutation.mutate(data as Record<string, unknown>);
    },
    (errors) => {
      // Without this branch, react-hook-form silently swallows invalid submits
      // and the user sees no feedback at all — the most-reported "nothing
      // happens when I click submit" symptom. Surface it as a toast and
      // scroll to the first invalid field.
      const firstKey = Object.keys(errors)[0];
      const firstMsg = firstKey
        ? (errors[firstKey] as { message?: string })?.message ?? "Pflichtfeld fehlt"
        : "Bitte Eingaben prüfen";
      toast({
        title: "Eingaben unvollständig",
        description: firstMsg,
        variant: "error",
      });
      if (firstKey) {
        const el = document.querySelector(`[name="${firstKey}"]`);
        if (el && "scrollIntoView" in el) {
          (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLElement).focus?.();
        }
      }
    }
  );

  return (
    <div className="space-y-5">
      {/* Action header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">{action.displayName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
        </div>
        {!isOnline && action.offlineBehavior === "queue" && (
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <WifiOff className="h-3.5 w-3.5" />
            Offline speichern
          </div>
        )}
      </div>

      {/* Form */}
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-5">
          <ActionFormRenderer action={action} isLoading={executeMutation.isPending} />

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onDone}
              disabled={executeMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button type="submit" size="lg" loading={executeMutation.isPending}>
              {!isOnline && action.offlineBehavior === "queue"
                ? "Offline speichern"
                : action.displayName}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

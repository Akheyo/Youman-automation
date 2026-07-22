import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, WifiOff, Loader2, CheckCircle2, Download, FileText, Info } from "lucide-react";
import { FormBuilder } from "@youman/config-engine";
import { apiClient } from "@/services/api";
import { syncService } from "@/services/syncService";
import { useAuthStore } from "@/stores/authStore";
import { useOfflineStore } from "@/stores/offlineStore";
import { ActionFormRenderer } from "@/components/forms/ActionFormRenderer";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/useToast";
import { getApiError } from "@/services/api";
import { DocumentRenderError, describePlaceholder, downloadDocument } from "@/services/documentService";
import { cn } from "@/utils/cn";
import type { ActionDefinition, ActionExecution, ExecutionDocumentInfo } from "@youman/shared";

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

interface DashboardSuccessState {
  document: ExecutionDocumentInfo | null;
  referenceNumber: string;
  resultKeys: string[];
}

/**
 * Finds the ActionExecution's `result` object regardless of nesting (the value
 * onSuccess receives can be the ActionExecution or the raw Axios response).
 */
function extractExecutionResult(raw: unknown): Record<string, unknown> | null {
  const carries = (o: unknown): o is Record<string, unknown> =>
    !!o && typeof o === "object" && ("document" in o || "erpQuoteNumber" in o || "erpOrderNumber" in o);
  const rec = (raw ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    rec["result"],
    (rec["data"] as Record<string, unknown> | undefined)?.["result"],
    rec,
    rec["data"],
  ];
  for (const c of candidates) if (carries(c)) return c;
  return (rec["result"] ?? (rec["data"] as Record<string, unknown> | undefined)?.["result"]) as
    | Record<string, unknown>
    | null ?? null;
}

function ActionForm({ action, isOnline, onDone }: ActionFormProps) {
  const schema = formBuilder.buildZodSchema(action);
  const initialValues = formBuilder.getInitialValues(action);
  const [successState, setSuccessState] = useState<DashboardSuccessState | null>(null);

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

      toast({ title: "Erfolgreich", description: `${action.displayName} ausgeführt.`, variant: "success" });

      // Angebot/Auftrag mit Dokument: Ergebnis-Panel mit Download anzeigen,
      // statt das Formular zu schließen. Zugriff robust gegen Verschachtelung.
      const resultData = extractExecutionResult(result);
      const documentInfo = (resultData?.["document"] as ExecutionDocumentInfo | undefined) ?? null;
      const isDocumentAction =
        !!documentInfo ||
        !!action.documentOutput ||
        !!resultData?.["erpQuoteNumber"] ||
        !!resultData?.["erpOrderNumber"];

      if (isDocumentAction) {
        setSuccessState({
          document: documentInfo,
          referenceNumber: String(resultData?.["erpQuoteNumber"] ?? resultData?.["erpOrderNumber"] ?? ""),
          resultKeys: resultData ? Object.keys(resultData) : [],
        });
        return;
      }

      onDone();
    },

    onError: (err) => {
      toast({ title: "Fehler", description: getApiError(err), variant: "error" });
    },
  });

  const onSubmit = methods.handleSubmit((data) => {
    executeMutation.mutate(data as Record<string, unknown>);
  });

  if (successState) {
    return (
      <DocumentSuccessPanel
        action={action}
        state={successState}
        onNew={() => {
          setSuccessState(null);
          methods.reset(initialValues);
        }}
        onDone={onDone}
      />
    );
  }

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

function DocumentSuccessPanel({
  action,
  state,
  onNew,
  onDone,
}: {
  action: ActionDefinition;
  state: DashboardSuccessState;
  onNew: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<"docx" | "pdf" | null>(null);
  const [renderError, setRenderError] = useState<DocumentRenderError | null>(null);
  const doc = state.document;

  const handleDownload = async (format: "docx" | "pdf") => {
    if (!doc) return;
    setBusy(format);
    setRenderError(null);
    if (format === "pdf") {
      toast({
        title: "PDF wird erstellt…",
        description: "Beim ersten Mal kann das bis zu einer Minute dauern (Server wacht auf).",
        variant: "info",
      });
    }
    try {
      const path = await downloadDocument(doc, format, state.referenceNumber || undefined);
      toast({
        title: "Dokument gespeichert",
        description: path ? `Gespeichert unter: ${path}` : "Der Download wurde gestartet.",
        variant: "success",
      });
    } catch (err) {
      const renderErr = err instanceof DocumentRenderError ? err : new DocumentRenderError(getApiError(err));
      setRenderError(renderErr);
      toast({ title: "Dokument konnte nicht erstellt werden", description: renderErr.message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
      <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
      <div>
        <h2 className="text-xl font-bold text-foreground">{action.displayName} erfolgreich</h2>
        {state.referenceNumber && (
          <p className="text-sm text-muted-foreground mt-1">Nummer: {state.referenceNumber}</p>
        )}
      </div>

      {doc?.templateId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Dokument herunterladen:</p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => handleDownload("pdf")} loading={busy === "pdf"} disabled={busy !== null} className="gap-2">
              <Download className="h-4 w-4" />
              Dokument herunterladen (PDF)
            </Button>
            <Button variant="outline" onClick={() => handleDownload("docx")} loading={busy === "docx"} disabled={busy !== null} className="gap-2">
              <FileText className="h-4 w-4" />
              DOCX herunterladen
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-left">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {doc?.hint ?? "Für dieses Angebot kam kein Dokument vom Server zurück. Bitte prüfen Sie, ob unter Administration » Dokumentvorlagen eine Angebots-Vorlage als Standard markiert ist."}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/60 font-mono break-all text-left">
            Debug – Antwortfelder: [{state.resultKeys.join(", ") || "leer"}]
            {state.resultKeys.includes("document") ? " · document: vorhanden, aber ohne Vorlagen-ID" : " · document: fehlt"}
          </p>
        </div>
      )}

      {renderError && renderError.missingFields.length > 0 && (
        <div className="mx-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-left">
          <p className="text-sm font-medium text-destructive">Folgende Felder fehlen für das Dokument:</p>
          <ul className="mt-1.5 list-disc pl-5 text-xs text-destructive/90 space-y-0.5">
            {renderError.missingFields.map((f) => (
              <li key={f}>{describePlaceholder(f)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onNew}>
          Weitere Aktion
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Fertig
        </Button>
      </div>
    </div>
  );
}

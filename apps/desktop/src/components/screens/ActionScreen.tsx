import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, FileText, Info, Loader2, WifiOff } from "lucide-react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@/services/api";
import { syncService } from "@/services/syncService";
import { useOfflineStore } from "@/stores/offlineStore";
import { useAuthStore } from "@/stores/authStore";
import { FormBuilder } from "@youman/config-engine";
import { Button } from "@/components/ui/button";
import { ActionFormRenderer } from "@/components/forms/ActionFormRenderer";
import { toast } from "@/hooks/useToast";
import { getApiError } from "@/services/api";
import { DocumentRenderError, describePlaceholder, downloadDocument } from "@/services/documentService";
import type { ActionDefinition, ActionExecution, ExecutionDocumentInfo } from "@youman/shared";

const formBuilder = new FormBuilder();

interface SuccessState {
  document: ExecutionDocumentInfo | null;
  referenceNumber: string;
  /** Diagnostic: top-level keys of the backend result (shown if no document came back). */
  resultKeys: string[];
}

export function ActionScreen() {
  const { actionId } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const { isOnline } = useOfflineStore();
  const { user } = useAuthStore();
  const [successState, setSuccessState] = useState<SuccessState | null>(null);

  const { data: action, isLoading } = useQuery({
    queryKey: ["action-definition", actionId],
    queryFn: async () => {
      const res = await apiClient.get<ActionDefinition[]>("/actions/definitions");
      const all = res.data as unknown as ActionDefinition[];
      return all.find((a) => a.id === actionId) ?? null;
    },
    enabled: !!actionId,
  });

  const schema = action ? formBuilder.buildZodSchema(action) : null;
  const initialValues = action ? formBuilder.getInitialValues(action) : {};

  const methods = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: initialValues,
  });

  const executeMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!action) throw new Error("Action nicht gefunden");

      if (!isOnline && action.offlineBehavior === "queue") {
        const queued = await syncService.enqueueOffline({
          actionId: action.id,
          actionName: action.displayName,
          payload,
        });

        if (!queued) throw new Error("Offline-Queue nicht verfügbar");

        return { status: "queued_offline", queueId: queued.id } as unknown as ActionExecution;
      }

      const res = await apiClient.post<ActionExecution>("/actions/execute", {
        actionId: action.id,
        payload,
        clientTimestamp: new Date().toISOString(),
      });
      return res.data;
    },

    onSuccess: async (result, payload) => {
      if (!action) return;

      if ((result as unknown as { status: string }).status === "queued_offline") {
        toast({
          title: "Aktion gespeichert",
          description: action.documentOutput
            ? "Die Aktion wird nach Wiederherstellung der Verbindung ausgeführt. Das Dokument wird erst nach erfolgreicher Synchronisation erstellt."
            : "Die Aktion wird nach Wiederherstellung der Verbindung ausgeführt.",
          variant: "warning",
        });
        navigate("/dashboard");
        return;
      }

      // Execute success actions
      for (const successAction of action.successActions) {
        await executeSuccessAction(successAction, result);
      }

      toast({
        title: "Erfolgreich",
        description: `${action.displayName} wurde ausgeführt.`,
        variant: "success",
      });

      // Nach erfolgreicher Online-Ausführung eines Angebots/Auftrags bleibt das
      // Ergebnis-Panel IMMER stehen (kein automatischer Rücksprung zum
      // Dashboard). Der Download hängt am Backend-Ergebnis (result.document);
      // fehlt es, zeigt das Panel die vorhandenen Felder zur Diagnose an.
      const resultData = result.result as Record<string, unknown> | null;
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

      navigate("/dashboard");
    },

    onError: (err) => {
      const msg = getApiError(err);
      toast({ title: "Fehler", description: msg, variant: "error" });
    },
  });

  const onSubmit = methods.handleSubmit((data) => {
    const payload = data as Record<string, unknown>;
    // FormBuilder validates flat fields, but not the rows inside line-item
    // tables – check those here with readable German messages.
    const problem = action ? validateLineItems(action, payload) : null;
    if (problem) {
      toast({ title: "Eingaben unvollständig", description: problem, variant: "error" });
      return;
    }
    executeMutation.mutate(payload);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!action) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Aktion nicht gefunden.</p>
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mt-3">
          Zurück
        </Button>
      </div>
    );
  }

  if (successState) {
    return (
      <ActionSuccessPanel
        action={action}
        state={successState}
        onDone={() => navigate("/dashboard")}
        onNew={() => {
          setSuccessState(null);
          methods.reset(initialValues);
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{action.displayName}</h1>
          <p className="text-sm text-muted-foreground">{action.description}</p>
        </div>
        {!isOnline && action.offlineBehavior === "queue" && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-warning">
            <WifiOff className="h-3.5 w-3.5" />
            Wird offline gespeichert
          </div>
        )}
      </div>

      {/* Form */}
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="space-y-6">
          <ActionFormRenderer action={action} isLoading={executeMutation.isPending} />

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(-1)}
              disabled={executeMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={executeMutation.isPending}
            >
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

const LINE_ITEM_LABELS: Record<string, string> = {
  productId: "Artikel",
  quantity: "Menge",
  pricePerUnit: "Einzelpreis",
};

/** Returns a German error message when a line-item table has invalid rows, else null. */
function validateLineItems(action: ActionDefinition, payload: Record<string, unknown>): string | null {
  for (const field of action.fields) {
    if (field.type !== "table_line_items") continue;
    const rows = payload[field.key];
    if (!Array.isArray(rows) || rows.length === 0) {
      return "Bitte mindestens eine Position hinzufügen.";
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      for (const col of field.lineItemColumns ?? []) {
        if (!col.required) continue;
        const value = row[col.key];
        const label = LINE_ITEM_LABELS[col.key] ?? col.label;
        if (col.type === "number") {
          if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
            return `Position ${i + 1}: ${label} muss größer als 0 sein.`;
          }
        } else if (value === undefined || value === null || String(value).trim() === "") {
          return col.key === "productId"
            ? `Position ${i + 1}: Bitte einen Artikel auswählen (im Feld „Artikel" suchen und Treffer anklicken).`
            : `Position ${i + 1}: ${label} fehlt.`;
        }
      }
    }
  }
  return null;
}

function ActionSuccessPanel({
  action,
  state,
  onDone,
  onNew,
}: {
  action: ActionDefinition;
  state: SuccessState;
  onDone: () => void;
  onNew: () => void;
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
        <div>
          <h1 className="text-xl font-bold text-foreground">{action.displayName} erfolgreich</h1>
          {state.referenceNumber && (
            <p className="text-sm text-muted-foreground mt-1">Nummer: {state.referenceNumber}</p>
          )}
        </div>

        {doc?.templateId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Dokument aus Ihrer Vorlage erstellen:</p>
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
            {/* Diagnose: zeigt, welche Felder die Server-Antwort tatsächlich enthielt. */}
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
            Zum Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

async function executeSuccessAction(
  successAction: ActionDefinition["successActions"][number],
  result: ActionExecution
): Promise<void> {
  switch (successAction.type) {
    case "open_pdf": {
      const urlField = successAction.config["urlField"] as string;
      const url = (result.result as Record<string, string> | null)?.[urlField];
      if (url && window.adept) await window.adept.pdf.open(url);
      break;
    }
    case "prepare_email": {
      const subject = String(successAction.config["subject"] ?? "");
      const body = String(successAction.config["body"] ?? "");
      const quoteNumber = (result.result as Record<string, string> | null)?.["erpQuoteNumber"] ?? "";
      const filledSubject = subject.replace("{quoteNumber}", quoteNumber);
      const filledBody = body.replace("{quoteNumber}", quoteNumber);
      const mailto = `mailto:?subject=${encodeURIComponent(filledSubject)}&body=${encodeURIComponent(filledBody)}`;
      if (window.adept) await window.adept.app.openExternal(mailto);
      break;
    }
  }
}

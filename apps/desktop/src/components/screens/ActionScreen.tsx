import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, WifiOff } from "lucide-react";
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
import type { ActionDefinition, ActionExecution } from "@youman/shared";

const formBuilder = new FormBuilder();

export function ActionScreen() {
  const { actionId } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const { isOnline } = useOfflineStore();
  const { user } = useAuthStore();

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
          description: "Die Aktion wird nach Wiederherstellung der Verbindung ausgeführt.",
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

      navigate("/dashboard");
    },

    onError: (err) => {
      const msg = getApiError(err);
      toast({ title: "Fehler", description: msg, variant: "error" });
    },
  });

  const onSubmit = methods.handleSubmit((data) => {
    executeMutation.mutate(data as Record<string, unknown>);
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

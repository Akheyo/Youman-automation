import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, RotateCcw, XCircle, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import type { QueueItem } from "@youman/shared";

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "default"; icon: React.ComponentType<{ className?: string | undefined }> }> = {
  pending: { label: "Ausstehend", variant: "warning", icon: Clock },
  processing: { label: "Wird verarbeitet", variant: "default", icon: Loader2 },
  success: { label: "Erfolgreich", variant: "success", icon: CheckCircle2 },
  failed: { label: "Fehlgeschlagen", variant: "destructive", icon: AlertTriangle },
  retrying: { label: "Wiederholen", variant: "warning", icon: RotateCcw },
  dead_letter: { label: "Fehlerhaft", variant: "destructive", icon: XCircle },
  cancelled: { label: "Abgebrochen", variant: "muted", icon: XCircle },
};

export function QueueScreen() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["queue", "items"],
    queryFn: async () => {
      const res = await apiClient.get<QueueItem[]>("/queue/items");
      return res.data as unknown as QueueItem[];
    },
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/queue/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      toast({ title: "Aktion wird wiederholt", variant: "info" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/queue/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      toast({ title: "Aktion abgebrochen", variant: "info" });
    },
  });

  const processMutation = useMutation({
    mutationFn: () => apiClient.post("/queue/process"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      toast({ title: "Verarbeitung gestartet", variant: "success" });
    },
  });

  const pending = items.filter((i) => ["pending", "retrying"].includes(i.status));
  const failed = items.filter((i) => ["failed", "dead_letter"].includes(i.status));
  const done = items.filter((i) => ["success", "cancelled"].includes(i.status));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Warteschlange</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Offline-Aktionen und ausstehende Synchronisierungen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Aktualisieren
          </Button>
          {pending.length > 0 && (
            <Button
              size="sm"
              onClick={() => processMutation.mutate()}
              loading={processMutation.isPending}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Jetzt verarbeiten ({pending.length})
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
          <p className="text-muted-foreground font-medium">Warteschlange ist leer</p>
          <p className="text-xs text-muted-foreground">Alle Aktionen wurden erfolgreich verarbeitet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { title: "Ausstehend", items: pending },
            { title: "Fehlgeschlagen", items: failed },
            { title: "Abgeschlossen", items: done },
          ].filter((g) => g.items.length > 0).map((group) => (
            <section key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {group.title} ({group.items.length})
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <QueueItemCard
                    key={item.id}
                    item={item}
                    onRetry={() => retryMutation.mutate(item.id)}
                    onCancel={() => cancelMutation.mutate(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueItemCard({
  item,
  onRetry,
  onCancel,
}: {
  item: QueueItem;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["pending"]!;
  const Icon = config.icon;
  const isRetryable = ["failed", "dead_letter"].includes(item.status);
  const isCancellable = ["pending", "retrying"].includes(item.status);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Icon className={cn(
        "h-4 w-4 mt-0.5 shrink-0",
        item.status === "processing" && "animate-spin",
        item.status === "success" && "text-success",
        ["failed", "dead_letter"].includes(item.status) && "text-destructive",
        ["pending", "retrying"].includes(item.status) && "text-warning",
        ["cancelled"].includes(item.status) && "text-muted-foreground",
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{item.actionName}</span>
          <Badge variant={config.variant}>{config.label}</Badge>
          {item.retryCount > 0 && (
            <span className="text-xs text-muted-foreground">Versuch {item.retryCount + 1}</span>
          )}
          {item.isOfflineCreated && (
            <Badge variant="muted">Offline erstellt</Badge>
          )}
        </div>

        {item.error && (
          <p className="text-xs text-destructive mt-1 truncate">{item.error}</p>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          {new Date(item.createdAt).toLocaleString("de-DE")}
          {item.completedAt && ` · Abgeschlossen: ${new Date(item.completedAt).toLocaleString("de-DE")}`}
        </p>
      </div>

      <div className="flex gap-1.5 shrink-0">
        {isRetryable && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-3 w-3" />
            Wiederholen
          </Button>
        )}
        {isCancellable && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

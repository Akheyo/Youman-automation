import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CheckCircle2, Clock, Copy, Download, FileText, Loader2, XCircle } from "lucide-react";
import { apiClient, getApiError } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import { LoadErrorNotice } from "@/components/ui/load-error";
import { DocumentRenderError, downloadDocument } from "@/services/documentService";
import type { ActionHistoryEntry } from "@youman/shared";

/** Der Verlauf zeigt nur Angebote – die übrigen Aktionen stehen im Protokoll. */
const QUOTE_ACTION_ID = "action-create-quote";
const PAGE_SIZE = 25;

interface HistoryResponse {
  items: ActionHistoryEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, { icon: React.ReactNode; label: string }> = {
  success: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, label: "Erstellt" },
  failed: { icon: <XCircle className="h-3.5 w-3.5 text-destructive" />, label: "Fehlgeschlagen" },
  running: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />, label: "Läuft" },
  pending: { icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />, label: "Wartet" },
  cancelled: { icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />, label: "Abgebrochen" },
};

function formatAmount(value: number | null, currency: string | null): string {
  if (value === null) return "–";
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  });
}

function DownloadButtons({ entry }: { entry: ActionHistoryEntry }) {
  const [busy, setBusy] = useState<"docx" | "pdf" | null>(null);
  if (!entry.document?.templateId) return <span className="text-xs text-muted-foreground">–</span>;

  const handle = async (format: "docx" | "pdf") => {
    setBusy(format);
    if (format === "pdf") {
      toast({
        title: "PDF wird erstellt…",
        description: "Beim ersten Mal kann das bis zu einer Minute dauern (Server wacht auf).",
        variant: "info",
      });
    }
    try {
      const path = await downloadDocument(entry.document!, format, entry.referenceNumber ?? undefined);
      toast({
        title: "Dokument gespeichert",
        description: path ? `Gespeichert unter: ${path}` : "Der Download wurde gestartet.",
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof DocumentRenderError ? err.message : getApiError(err);
      toast({ title: "Download fehlgeschlagen", description: msg, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handle("pdf")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        {busy === "pdf" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        PDF
      </button>
      <button
        type="button"
        onClick={() => void handle("docx")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-50"
      >
        {busy === "docx" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        DOCX
      </button>
    </div>
  );
}

/**
 * Übernimmt ein früheres Angebot als Ausgangspunkt für ein neues.
 *
 * Es wird bewusst nichts überschrieben: Das alte Angebot bleibt im Verlauf
 * stehen, die Übernahme öffnet nur das Formular mit denselben Werten. Beim
 * Speichern entsteht ein neuer Vorgang mit neuer Angebotsnummer.
 */
function ReuseButton({ entry }: { entry: ActionHistoryEntry }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const res = await apiClient.get<{ actionId: string; payload: Record<string, unknown> }>(
        `/actions/history/${entry.id}`
      );
      const { actionId, payload } = res.data as unknown as {
        actionId: string;
        payload: Record<string, unknown>;
      };
      navigate(`/action/${actionId}`, { state: { prefill: payload } });
    } catch (err) {
      toast({ title: "Übernehmen fehlgeschlagen", description: getApiError(err), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handle()}
      disabled={busy}
      title="Als Grundlage für ein neues Angebot öffnen"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
      Übernehmen
    </button>
  );
}

export function HistoryScreen() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["quote-history", page],
    queryFn: async () => {
      const res = await apiClient.get<HistoryResponse>(
        `/actions/history?actionId=${QUOTE_ACTION_ID}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      return res.data as unknown as HistoryResponse;
    },
  });

  const { items = [], total = 0, totalPages = 1 } = data ?? {};

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Angebote</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} {total === 1 ? "Angebot" : "Angebote"} · Seite {page} von {totalPages}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <LoadErrorNotice what="Der Angebotsverlauf" onRetry={() => void refetch()} />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-8" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nummer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunde</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Netto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pos.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bearbeiter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dokument</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weiterarbeiten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((entry) => {
                const status = STATUS_BADGE[entry.status] ?? STATUS_BADGE.pending!;
                return (
                  <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3" title={status.label}>{status.icon}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.executedAt).toLocaleString("de-DE")}
                    </td>
                    <td className="px-4 py-3">
                      {entry.referenceNumber ? (
                        <Badge variant="muted" className="text-xs font-mono">An-{entry.referenceNumber}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-[16rem] truncate" title={entry.customerName ?? ""}>
                      {entry.customerName ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground text-right whitespace-nowrap font-mono">
                      {formatAmount(entry.totalNet, entry.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground text-right">
                      {entry.positionCount ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.userName}</td>
                    <td className="px-4 py-3">
                      {entry.status === "failed" ? (
                        <span className="text-xs text-destructive" title={entry.error ?? ""}>
                          {entry.error ? entry.error.slice(0, 60) : "Fehlgeschlagen"}
                        </span>
                      ) : (
                        <DownloadButtons entry={entry} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReuseButton entry={entry} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Noch keine Angebote erstellt</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-border rounded-md disabled:opacity-40 hover:bg-secondary"
          >
            Zurück
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-border rounded-md disabled:opacity-40 hover:bg-secondary"
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}

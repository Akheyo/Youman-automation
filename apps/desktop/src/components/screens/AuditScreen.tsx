import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Loader2, AlertTriangle, XCircle, Info, Download } from "lucide-react";
import { apiClient, getApiError } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import { DocumentRenderError, downloadDocument } from "@/services/documentService";
import type { AuditLog, ExecutionDocumentInfo } from "@youman/shared";

/** Extracts a downloadable document (+ reference number) from an execution log entry. */
function documentFromLog(log: AuditLog): { info: ExecutionDocumentInfo; ref: string } | null {
  const result = (log.metadata as { result?: Record<string, unknown> } | undefined)?.result;
  const doc = result?.["document"] as ExecutionDocumentInfo | undefined;
  if (!doc || !doc.templateId) return null;
  const ref = String(result?.["erpQuoteNumber"] ?? result?.["erpOrderNumber"] ?? "");
  return { info: doc, ref };
}

function DocumentDownloadButton({ info, refNr }: { info: ExecutionDocumentInfo; refNr: string }) {
  const [busy, setBusy] = useState(false);
  const handle = async (format: "docx" | "pdf") => {
    setBusy(true);
    if (format === "pdf") {
      toast({
        title: "PDF wird erstellt…",
        description: "Beim ersten Mal kann das bis zu einer Minute dauern (Server wacht auf).",
        variant: "info",
      });
    }
    try {
      const path = await downloadDocument(info, format, refNr || undefined);
      toast({
        title: "Dokument gespeichert",
        description: path ? `Gespeichert unter: ${path}` : "Der Download wurde gestartet.",
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof DocumentRenderError ? err.message : getApiError(err);
      toast({ title: "Download fehlgeschlagen", description: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => handle("pdf")}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        PDF
      </button>
      <button
        type="button"
        onClick={() => handle("docx")}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-50"
      >
        DOCX
      </button>
    </div>
  );
}

const SEVERITY_ICON = {
  INFO: <Info className="h-3.5 w-3.5 text-primary" />,
  WARNING: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  ERROR: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  CRITICAL: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function AuditScreen() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page],
    queryFn: async () => {
      const res = await apiClient.get<{ items: AuditLog[]; total: number; totalPages: number }>(
        `/audit?page=${page}&pageSize=50`
      );
      return res.data as unknown as { items: AuditLog[]; total: number; totalPages: number };
    },
  });

  const { items = [], total = 0, totalPages = 1 } = data ?? {};

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Aktivitätsprotokoll</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} Einträge · Seite {page} von {totalPages}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-8" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zeitpunkt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ereignis</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Benutzer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Beschreibung</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dokument</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((log) => {
                const doc = documentFromLog(log);
                return (
                <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    {SEVERITY_ICON[log.severity] ?? SEVERITY_ICON.INFO}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("de-DE")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="muted" className="text-xs">{log.eventType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.userEmail ?? "–"}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground max-w-xs truncate">
                    {log.description}
                  </td>
                  <td className="px-4 py-3">
                    {doc && <DocumentDownloadButton info={doc.info} refNr={doc.ref} />}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Keine Einträge</p>
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

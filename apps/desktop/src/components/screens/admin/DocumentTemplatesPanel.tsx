import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileText, Loader2, Pencil, Star, Trash2, Upload } from "lucide-react";
import { apiClient, getApiError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import type { ActionDefinition, DocumentTemplateInfo, DocumentType } from "@youman/shared";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "OFFER", label: "Angebot" },
  { value: "INVOICE", label: "Rechnung" },
  { value: "ORDER_CONFIRMATION", label: "Auftragsbestätigung" },
  { value: "DELIVERY_NOTE", label: "Lieferschein" },
  { value: "OTHER", label: "Sonstiges" },
];

const typeLabel = (t: string): string => DOC_TYPES.find((d) => d.value === t)?.label ?? t;

export function DocumentTemplatesPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<DocumentType>("OFFER");
  const [uploadName, setUploadName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates"],
    queryFn: async () => (await apiClient.get<DocumentTemplateInfo[]>("/templates")).data,
  });

  // Coverage check: compare each documentOutput mapping against the default
  // template's placeholders so admins see gaps before the first render fails.
  const { data: actionDefs = [] } = useQuery({
    queryKey: ["action-definitions"],
    queryFn: async () => (await apiClient.get<ActionDefinition[]>("/actions/definitions")).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["document-templates"] });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("name", uploadName.trim() || file.name.replace(/\.docx$/i, ""));
      form.append("documentType", uploadType);
      return (await apiClient.post<DocumentTemplateInfo>("/templates", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: (tpl) => {
      invalidate();
      setUploadName("");
      toast({
        title: `Vorlage '${tpl.name}' hochgeladen`,
        description: `${tpl.placeholders.length} Platzhalter erkannt`,
        variant: "success",
      });
    },
    onError: (err) => toast({ title: "Upload fehlgeschlagen", description: getApiError(err), variant: "error" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      (await apiClient.patch(`/templates/${id}`, { name })).data,
    onSuccess: () => {
      invalidate();
      setRenamingId(null);
    },
    onError: (err) => toast({ title: "Umbenennen fehlgeschlagen", description: getApiError(err), variant: "error" }),
  });

  const defaultMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/templates/${id}/default`)).data,
    onSuccess: () => invalidate(),
    onError: (err) => toast({ title: "Fehler", description: getApiError(err), variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/templates/${id}`)).data,
    onSuccess: () => {
      invalidate();
      setConfirmDeleteId(null);
      toast({ title: "Vorlage gelöscht", variant: "success" });
    },
    onError: (err) => toast({ title: "Löschen fehlgeschlagen", description: getApiError(err), variant: "error" }),
  });

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast({ title: "Nur .docx-Dateien", description: "Bitte eine Word-Vorlage (.docx) auswählen.", variant: "error" });
      return;
    }
    uploadMutation.mutate(file);
  };

  /** Placeholders of a default template that no action mapping covers. */
  const uncoveredFor = (tpl: DocumentTemplateInfo): string[] => {
    if (!tpl.isDefault) return [];
    const mappings = actionDefs
      .filter((a) => a.documentOutput?.documentType === tpl.documentType)
      .map((a) => a.documentOutput!.fieldMapping);
    if (mappings.length === 0) return [];
    const covered = new Set(mappings.flatMap((m) => Object.keys(m)));
    return tpl.placeholders
      .filter((p) => !p.includes(".")) // loop children are covered via the loop mapping
      .filter((p) => !covered.has(p));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Dokumentvorlagen</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Word-Vorlagen (.docx) mit Platzhaltern wie {"{{angebotsnummer}}"} – werden bei Aktionen automatisch befüllt.
        </p>
      </div>

      {/* Upload */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Neue Vorlage hochladen</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dokumenttyp</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as DocumentType)}
              className="h-9 rounded-md border border-input bg-input px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="text-xs text-muted-foreground">Anzeigename (optional)</label>
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="z.B. Angebot Standard" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              handleFileChosen(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} loading={uploadMutation.isPending} className="gap-2">
            <Upload className="h-4 w-4" />
            .docx auswählen
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-lg">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Vorlagen hochgeladen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const uncovered = uncoveredFor(tpl);
            return (
              <div key={tpl.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    {renamingId === tpl.id ? (
                      <div className="flex items-center gap-2">
                        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-8" autoFocus />
                        <Button
                          size="sm" className="h-8"
                          loading={renameMutation.isPending}
                          onClick={() => renameValue.trim() && renameMutation.mutate({ id: tpl.id, name: renameValue.trim() })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setRenamingId(null)}>Abbrechen</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">{tpl.name}</p>
                        <Badge variant="secondary">{typeLabel(tpl.documentType)}</Badge>
                        {tpl.isDefault && <Badge>Standard</Badge>}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.fileName}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!tpl.isDefault && (
                      <Button
                        size="sm" variant="ghost" className="gap-1.5"
                        onClick={() => defaultMutation.mutate(tpl.id)}
                        loading={defaultMutation.isPending}
                        title="Als Standard-Vorlage festlegen"
                      >
                        <Star className="h-3.5 w-3.5" />
                        Standard
                      </Button>
                    )}
                    <Button
                      size="icon-sm" variant="ghost"
                      onClick={() => { setRenamingId(tpl.id); setRenameValue(tpl.name); }}
                      title="Umbenennen"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm" variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(tpl.id)}
                      title="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Placeholder chips */}
                <div className="flex flex-wrap gap-1.5">
                  {tpl.placeholders.map((p) => (
                    <span key={p} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                      {p}
                    </span>
                  ))}
                </div>

                {/* Mapping coverage warning */}
                {uncovered.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">
                      Die Aktions-Konfiguration befüllt folgende Platzhalter <span className="font-semibold">nicht</span>:{" "}
                      <span className="font-mono">{uncovered.join(", ")}</span> – die Dokumenterstellung wird fehlschlagen,
                      bis die Platzhalter aus der Vorlage entfernt oder im Mapping ergänzt werden.
                    </p>
                  </div>
                )}

                {/* Delete confirmation */}
                {confirmDeleteId === tpl.id && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
                    <p className="text-xs text-foreground">Vorlage „{tpl.name}" wirklich löschen?</p>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="destructive" className="h-7" loading={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(tpl.id)}>
                        Löschen
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDeleteId(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

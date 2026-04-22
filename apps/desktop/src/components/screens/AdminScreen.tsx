import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings, Users, Palette, Plug, ChevronRight, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";

type AdminTab = "general" | "branding" | "connector" | "users";

const TABS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "Allgemein", icon: Settings },
  { id: "branding", label: "Erscheinungsbild", icon: Palette },
  { id: "connector", label: "Connector", icon: Plug },
  { id: "users", label: "Benutzer", icon: Users },
];

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>("general");
  const { user } = useAuthStore();

  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "SUPER_ADMIN";

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-16">
        <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Keine Berechtigung für diesen Bereich.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">Tenant-Einstellungen und Konfiguration</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "branding" && <BrandingSettings />}
          {activeTab === "connector" && <ConnectorSettings />}
          {activeTab === "users" && <UsersPanel />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const res = await apiClient.get("/tenants/settings");
      return res.data as Record<string, unknown>;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Allgemeine Einstellungen</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">Standard-Währung</span>
          <span className="text-foreground font-medium">{String(data?.["defaultCurrency"] ?? "EUR")}</span>
          <span className="text-muted-foreground">Zeitzone</span>
          <span className="text-foreground font-medium">{String(data?.["timezone"] ?? "Europe/Berlin")}</span>
          <span className="text-muted-foreground">Offline-Modus</span>
          <Badge variant={data?.["enableOfflineMode"] ? "success" : "muted"}>
            {data?.["enableOfflineMode"] ? "Aktiviert" : "Deaktiviert"}
          </Badge>
          <span className="text-muted-foreground">Session Timeout</span>
          <span className="text-foreground font-medium">{Number(data?.["sessionTimeoutMinutes"] ?? 480)} Minuten</span>
        </div>
      </div>
    </div>
  );
}

function BrandingSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>("/branding");
      return res.data as Record<string, unknown>;
    },
  });

  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiClient.patch("/branding", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding"] });
      toast({ title: "Branding gespeichert", variant: "success" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Erscheinungsbild</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">App-Name</label>
            <Input defaultValue={String(data?.["appName"] ?? "Youman")} id="appName" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Primärfarbe</label>
            <div className="flex gap-2">
              <input
                type="color"
                defaultValue={String(data?.["primaryColor"] ?? "#2563EB")}
                id="primaryColor"
                className="h-9 w-12 rounded border border-input cursor-pointer bg-input"
              />
              <Input defaultValue={String(data?.["primaryColor"] ?? "#2563EB")} className="font-mono text-xs" />
            </div>
          </div>
        </div>
        <Button
          onClick={() => mutation.mutate({
            appName: (document.getElementById("appName") as HTMLInputElement)?.value,
            primaryColor: (document.getElementById("primaryColor") as HTMLInputElement)?.value,
          })}
          loading={mutation.isPending}
          size="sm"
        >
          Speichern
        </Button>
      </div>
    </div>
  );
}

function ConnectorSettings() {
  const { tenant } = useAuthStore();

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">ERP-Connector</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">Connector-Typ</span>
          <span className="text-foreground font-medium">
            {tenant?.connectorConfig?.connectorType ?? "MOCK"}
          </span>
          <span className="text-muted-foreground">Status</span>
          <Badge variant={tenant?.connectorConfig?.enabled ? "success" : "muted"}>
            {tenant?.connectorConfig?.enabled ? "Aktiv" : "Inaktiv"}
          </Badge>
          <span className="text-muted-foreground">Bezeichnung</span>
          <span className="text-foreground font-medium">
            {tenant?.connectorConfig?.displayName ?? "–"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Connector-Konfiguration kann nur über das Admin-Backend geändert werden.
          Bitte wenden Sie sich an Ihren Systemadministrator.
        </p>
      </div>
    </div>
  );
}

function UsersPanel() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean }>>("/users");
      return res.data as unknown as Array<{ id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean }>;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Benutzer ({users.length})</h2>
      <div className="border border-border rounded-lg overflow-hidden">
        {users.map((u, idx) => (
          <div
            key={u.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              idx > 0 && "border-t border-border",
              "hover:bg-secondary/20 transition-colors"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary text-xs font-semibold">
                {u.firstName?.[0]}{u.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <Badge variant={u.isActive ? "success" : "muted"}>
              {u.role}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

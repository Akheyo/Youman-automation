import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings, Users, Palette, Plug, ChevronRight, Loader2, CheckCircle2, XCircle, FlaskConical, FileText } from "lucide-react";
import { DocumentTemplatesPanel } from "./admin/DocumentTemplatesPanel";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";

type AdminTab = "general" | "branding" | "connector" | "documents" | "users";

const TABS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string | undefined }> }[] = [
  { id: "general", label: "Allgemein", icon: Settings },
  { id: "branding", label: "Erscheinungsbild", icon: Palette },
  { id: "connector", label: "Connector", icon: Plug },
  { id: "documents", label: "Dokumentvorlagen", icon: FileText },
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
          {activeTab === "documents" && <DocumentTemplatesPanel />}
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
            <Input defaultValue={String(data?.["appName"] ?? "adept&")} id="appName" />
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

type ConnectorType = "MOCK" | "SAP_ODATA" | "REST_GENERIC" | "PLENTY";
type AuthType = "none" | "basic" | "bearer" | "apikey";

interface ConnectorFormState {
  connectorType: ConnectorType;
  displayName: string;
  enabled: boolean;
  baseUrl: string;
  authType: AuthType;
  username: string;
  password: string;
  token: string;
  apiKeyHeader: string;
  apiKeyValue: string;
  epCustomers: string;
  epProducts: string;
  epQuotes: string;
  epTasks: string;
  epAppointments: string;
  epNotes: string;
  searchParam: string;
  plentyId: string;
  plentyWarehouseId: string;
  plentyCurrency: string;
  plentyReferrerId: string;
}

const DEFAULTS: ConnectorFormState = {
  connectorType: "MOCK", displayName: "ERP Connector", enabled: true,
  baseUrl: "", authType: "none", username: "", password: "", token: "",
  apiKeyHeader: "X-API-Key", apiKeyValue: "",
  epCustomers: "/customers", epProducts: "/products", epQuotes: "/quotes",
  epTasks: "/tasks", epAppointments: "/appointments", epNotes: "/notes",
  searchParam: "q",
  plentyId: "", plentyWarehouseId: "", plentyCurrency: "EUR", plentyReferrerId: "",
};

function ConnectorSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ConnectorFormState | null>(null);
  const [testResult, setTestResult] = useState<{ healthy: boolean; message?: string; latencyMs?: number } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { isLoading, isError, refetch } = useQuery({
    queryKey: ["connector-config"],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>("/tenants/connector");
      const d = res.data as Record<string, unknown>;
      const cfg = (d?.["config"] ?? {}) as Record<string, unknown>;
      const auth = (cfg?.["auth"] ?? {}) as Record<string, unknown>;
      const endpoints = (cfg?.["endpoints"] ?? {}) as Record<string, unknown>;
      setForm({
        connectorType: (d?.["connectorType"] as ConnectorType) ?? "MOCK",
        displayName: String(d?.["displayName"] ?? "ERP Connector"),
        enabled: Boolean(d?.["enabled"] ?? true),
        baseUrl: String(cfg?.["baseUrl"] ?? ""),
        authType: (auth?.["type"] as AuthType) ?? "none",
        // PLENTY stores credentials at config top level; the backend redacts
        // the password (empty field on save = keep stored password).
        username: String(auth?.["username"] ?? cfg?.["username"] ?? ""),
        password: String(auth?.["password"] ?? ""),
        token: String(auth?.["token"] ?? ""),
        apiKeyHeader: String(auth?.["apiKeyHeader"] ?? "X-API-Key"),
        apiKeyValue: String(auth?.["apiKeyValue"] ?? ""),
        epCustomers: String(endpoints?.["customers"] ?? "/customers"),
        epProducts: String(endpoints?.["products"] ?? "/products"),
        epQuotes: String(endpoints?.["quotes"] ?? "/quotes"),
        epTasks: String(endpoints?.["tasks"] ?? "/tasks"),
        epAppointments: String(endpoints?.["appointments"] ?? "/appointments"),
        epNotes: String(endpoints?.["notes"] ?? "/notes"),
        searchParam: String(cfg?.["searchParam"] ?? "q"),
        plentyId: cfg?.["plentyId"] != null ? String(cfg["plentyId"]) : "",
        plentyWarehouseId: cfg?.["defaultWarehouseId"] != null ? String(cfg["defaultWarehouseId"]) : "",
        plentyCurrency: String(cfg?.["defaultCurrency"] ?? "EUR"),
        plentyReferrerId: cfg?.["defaultReferrerId"] != null ? String(cfg["defaultReferrerId"]) : "",
      });
      return d;
    },
    // Hinweis: KEIN onError hier – React Query v5 unterstützt onError auf
    // useQuery nicht mehr (der frühere Cast hat das nur verschleiert, der
    // Handler feuerte nie). Der Fehlerzustand wird unten im Render behandelt.
  });

  const saveMutation = useMutation({
    mutationFn: (f: ConnectorFormState) => apiClient.patch("/tenants/connector", {
      connectorType: f.connectorType,
      displayName: f.displayName,
      enabled: f.enabled,
      config: f.connectorType === "MOCK" ? {} : f.connectorType === "PLENTY" ? {
        baseUrl: f.baseUrl,
        username: f.username,
        password: f.password,
        plentyId: Number(f.plentyId) || 0,
        ...(f.plentyWarehouseId ? { defaultWarehouseId: Number(f.plentyWarehouseId) } : {}),
        defaultCurrency: f.plentyCurrency || "EUR",
        ...(f.plentyReferrerId ? { defaultReferrerId: Number(f.plentyReferrerId) } : {}),
      } : {
        baseUrl: f.baseUrl,
        searchParam: f.searchParam || "q",
        auth: f.authType === "none" ? { type: "none" } :
              f.authType === "basic" ? { type: "basic", username: f.username, password: f.password } :
              f.authType === "bearer" ? { type: "bearer", token: f.token } :
              { type: "apikey", apiKeyHeader: f.apiKeyHeader, apiKeyValue: f.apiKeyValue },
        endpoints: {
          customers: f.epCustomers, products: f.epProducts, quotes: f.epQuotes,
          tasks: f.epTasks, appointments: f.epAppointments, notes: f.epNotes,
        },
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connector-config"] });
      toast({ title: "Connector gespeichert", variant: "success" });
      setTestResult(null);
    },
    onError: () => toast({ title: "Fehler beim Speichern", variant: "error" }),
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.post<{ healthy: boolean; message?: string; latencyMs?: number }>("/tenants/connector/test"),
    onSuccess: (res) => setTestResult(res.data),
    onError: () => setTestResult({ healthy: false, message: "Verbindungstest fehlgeschlagen" }),
  });

  const set = (k: keyof ConnectorFormState, v: unknown) =>
    setForm((prev) => prev ? { ...prev, [k]: v } : prev);

  // Fehlgeschlagener Config-Load: kein ewiger Spinner, sondern Meldung mit
  // "Erneut versuchen" und der Möglichkeit, mit Standardwerten fortzufahren.
  if (isError && !form) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <p className="text-sm text-foreground">
          Die Connector-Konfiguration konnte nicht geladen werden. Der Server ist
          möglicherweise gerade nicht erreichbar.
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => void refetch()}>Erneut versuchen</Button>
          <Button size="sm" variant="outline" onClick={() => setForm(DEFAULTS)}>
            Mit Standardwerten fortfahren
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !form) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">ERP-Connector</h2>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        {/* Type + Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Connector-Typ</label>
            <select
              value={form.connectorType}
              onChange={(e) => set("connectorType", e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="MOCK">Mock (Demo/Test)</option>
              <option value="SAP_ODATA">SAP OData</option>
              <option value="REST_GENERIC">REST API (Generic)</option>
              <option value="PLENTY">Plentymarkets</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bezeichnung</label>
            <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
          </div>
        </div>

        {form.connectorType !== "MOCK" && (
          <>
            {/* Base URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Basis-URL</label>
              <Input
                value={form.baseUrl}
                onChange={(e) => set("baseUrl", e.target.value)}
                placeholder={form.connectorType === "PLENTY" ? "https://xy123.my.plentysystems.com/rest" : "https://api.example.com"}
                className="font-mono text-sm"
              />
            </div>

            {/* Plentymarkets: fixed username/password auth + Mandanten-Einstellungen */}
            {form.connectorType === "PLENTY" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">API-Benutzer</label>
                    <Input value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Passwort</label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="Leer lassen, um gespeichertes Passwort zu behalten"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Plenty-ID (Mandant)</label>
                    <Input value={form.plentyId} onChange={(e) => set("plentyId", e.target.value)} placeholder="1000" className="font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Standard-Lager-ID (optional)</label>
                    <Input value={form.plentyWarehouseId} onChange={(e) => set("plentyWarehouseId", e.target.value)} placeholder="1" className="font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Währung</label>
                    <Input value={form.plentyCurrency} onChange={(e) => set("plentyCurrency", e.target.value)} placeholder="EUR" className="font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Referrer-ID (optional)</label>
                    <Input value={form.plentyReferrerId} onChange={(e) => set("plentyReferrerId", e.target.value)} placeholder="1" className="font-mono text-sm" />
                  </div>
                </div>
              </>
            )}

            {/* Auth */}
            {form.connectorType !== "PLENTY" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Authentifizierung</label>
                <select
                  value={form.authType}
                  onChange={(e) => set("authType", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="none">Keine</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="apikey">API Key</option>
                </select>
              </div>

              {form.authType === "basic" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Benutzername</label>
                    <Input value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Passwort</label>
                    <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
                  </div>
                </div>
              )}
              {form.authType === "bearer" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Bearer Token</label>
                  <Input type="password" value={form.token} onChange={(e) => set("token", e.target.value)} placeholder="eyJ..." className="font-mono text-xs" autoComplete="off" />
                </div>
              )}
              {form.authType === "apikey" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Header-Name</label>
                    <Input value={form.apiKeyHeader} onChange={(e) => set("apiKeyHeader", e.target.value)} placeholder="X-API-Key" className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">API Key</label>
                    <Input type="password" value={form.apiKeyValue} onChange={(e) => set("apiKeyValue", e.target.value)} autoComplete="off" />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Advanced endpoints */}
            {form.connectorType === "REST_GENERIC" && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ChevronRight className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")} />
                  Endpunkt-Pfade konfigurieren
                </button>

                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Suchparameter</label>
                      <Input value={form.searchParam} onChange={(e) => set("searchParam", e.target.value)} placeholder="q" className="font-mono text-xs" />
                    </div>
                    {[
                      ["epCustomers", "Kunden"],
                      ["epProducts", "Artikel"],
                      ["epQuotes", "Angebote"],
                      ["epTasks", "Aufgaben"],
                      ["epAppointments", "Termine"],
                      ["epNotes", "Notizen"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{label}</label>
                        <Input
                          value={String(form[key as keyof ConnectorFormState])}
                          onChange={(e) => set(key as keyof ConnectorFormState, e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Test result */}
        {testResult && (
          <div className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
            testResult.healthy ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {testResult.healthy
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <XCircle className="h-4 w-4 shrink-0" />}
            <span>
              {testResult.healthy
                ? `Verbindung erfolgreich (${testResult.latencyMs ?? "–"} ms)`
                : (testResult.message ?? "Verbindung fehlgeschlagen")}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={() => form && saveMutation.mutate(form)} loading={saveMutation.isPending} size="sm">
            Speichern
          </Button>
          {form.connectorType !== "MOCK" && (
            <Button
              variant="outline" size="sm"
              onClick={() => { saveMutation.mutate(form); setTimeout(() => testMutation.mutate(), 500); }}
              loading={testMutation.isPending}
              className="gap-1.5"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Verbindung testen
            </Button>
          )}
        </div>
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

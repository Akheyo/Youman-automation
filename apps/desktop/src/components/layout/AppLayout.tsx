import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Clock, FileText, Shield, Settings, Server,
  LogOut, Wifi, WifiOff, Loader2, Download, RefreshCw, Calculator,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useOfflineStore } from "@/stores/offlineStore";
import { syncService } from "@/services/syncService";
import { apiClient } from "@/services/api";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/useToast";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cost-analysis", icon: Calculator, label: "Kostenanalyse" },
  { to: "/queue", icon: Clock, label: "Warteschlange" },
  { to: "/audit", icon: FileText, label: "Protokoll" },
  { to: "/admin", icon: Settings, label: "Administration" },
];

type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

export function AppLayout() {
  const { user, tenant, logout } = useAuthStore();
  const { isOnline, syncStatus, isSyncing } = useOfflineStore();
  const navigate = useNavigate();
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

  useEffect(() => {
    if (!window.adept) return;
    const handler = (msg: unknown) => {
      const { type, version } = msg as { type: string; version?: string };
      if (type === "available") {
        setUpdateState("downloading");
        setUpdateVersion(version ?? null);
      } else if (type === "downloaded") {
        setUpdateState("ready");
        setUpdateVersion(version ?? null);
      } else if (type === "error") {
        setUpdateState("error");
      }
    };
    window.adept.on("app:update", handler);
    return () => window.adept?.off("app:update", handler);
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.adept) return;
    setUpdateState("checking");
    try {
      await window.adept.app.checkForUpdates();
      setTimeout(() => setUpdateState(s => s === "checking" ? "idle" : s), 5000);
    } catch {
      setUpdateState("idle");
    }
  };

  const handleInstall = async () => {
    if (!window.adept) return;
    setIsInstalling(true);
    await window.adept.app.installUpdate();
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore network errors on logout
    }
    logout();
    navigate("/login");
    toast({ title: "Abgemeldet", variant: "info" });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-border bg-card shrink-0">
        {/* Logo / App name */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border titlebar-drag">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">&amp;</span>
          </div>
          <div className="titlebar-no-drag min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {tenant?.branding.appName ?? "adept&"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{tenant?.name}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.to === "/queue" && syncStatus.pendingCount > 0 && (
                <Badge variant="warning" className="ml-auto text-xs px-1.5 py-0">
                  {syncStatus.pendingCount}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sync status */}
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            {isSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : isOnline ? (
              <Wifi className="h-3 w-3 text-success" />
            ) : (
              <WifiOff className="h-3 w-3 text-destructive" />
            )}
            <span className="text-muted-foreground">
              {isSyncing ? "Synchronisiert..." : isOnline ? "Online" : "Offline"}
            </span>
            {syncStatus.failedCount > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0">
                {syncStatus.failedCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Update banner */}
        {updateState === "ready" && (
          <div className="mx-3 mb-2 rounded-md bg-primary/8 border border-primary/20 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs font-semibold text-primary">Update bereit{updateVersion ? ` (v${updateVersion})` : ""}</p>
            </div>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleInstall}
              loading={isInstalling}
            >
              {isInstalling ? "Wird neu gestartet…" : "Jetzt installieren"}
            </Button>
          </div>
        )}
        {updateState === "downloading" && (
          <div className="mx-3 mb-2 rounded-md bg-muted border border-border p-2.5">
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
              <p className="text-xs text-muted-foreground">Update wird geladen…</p>
            </div>
          </div>
        )}

        {/* User */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary text-xs font-semibold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/settings")}
              title="Server-Einstellungen"
              className="shrink-0"
            >
              <Server className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCheckForUpdates}
              title={updateState === "checking" ? "Suche…" : "Nach Updates suchen"}
              className="shrink-0"
              disabled={updateState === "checking" || updateState === "downloading" || updateState === "ready"}
            >
              {updateState === "checking"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              title="Abmelden"
              className="shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Title bar space for Electron */}
        <div className="h-8 titlebar-drag shrink-0" />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

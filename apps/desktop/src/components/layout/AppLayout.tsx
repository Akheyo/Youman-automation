import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard, Clock, FileText, Shield, Settings,
  LogOut, Wifi, WifiOff, Loader2, ChevronDown
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
  { to: "/queue", icon: Clock, label: "Warteschlange" },
  { to: "/audit", icon: FileText, label: "Protokoll" },
  { to: "/admin", icon: Settings, label: "Administration" },
];

export function AppLayout() {
  const { user, tenant, logout } = useAuthStore();
  const { isOnline, syncStatus, isSyncing } = useOfflineStore();
  const navigate = useNavigate();

  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

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
            <span className="text-primary-foreground font-bold text-sm">Y</span>
          </div>
          <div className="titlebar-no-drag min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {tenant?.branding.appName ?? "Youman"}
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

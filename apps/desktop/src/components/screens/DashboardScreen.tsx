import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, UserPlus, Package, Calendar, StickyNote,
  ClipboardList, ArrowRight, Zap, TrendingUp, Clock
} from "lucide-react";
import { apiClient } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useOfflineStore } from "@/stores/offlineStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { ActionDefinition } from "@youman/shared";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, UserPlus, Package, Calendar,
  StickyNote, ClipboardList, Zap, TrendingUp,
};

const CATEGORY_COLORS: Record<string, string> = {
  sales: "text-blue-700 bg-blue-100",
  crm: "text-violet-700 bg-violet-100",
  inventory: "text-emerald-700 bg-emerald-100",
  purchasing: "text-orange-700 bg-orange-100",
  administration: "text-stone-600 bg-stone-200",
  logistics: "text-cyan-700 bg-cyan-100",
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Vertrieb",
  crm: "CRM",
  inventory: "Lager",
  purchasing: "Einkauf",
  administration: "Administration",
  logistics: "Logistik",
};

export function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { syncStatus, isOnline } = useOfflineStore();

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["actions", "definitions"],
    queryFn: async () => {
      const res = await apiClient.get<ActionDefinition[]>("/actions/definitions");
      return res.data as unknown as ActionDefinition[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredActions = actions.filter(
    (a) => a.enabled && a.allowedRoles.includes(user?.role ?? "VIEWER")
  );

  const grouped = filteredActions.reduce<Record<string, ActionDefinition[]>>((acc, a) => {
    const cat = a.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(a);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Guten Tag, {user?.firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Was möchten Sie heute erledigen?
          </p>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3">
          {syncStatus.pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/queue")}
              className="gap-2"
            >
              <Clock className="h-3.5 w-3.5 text-warning" />
              {syncStatus.pendingCount} ausstehend
            </Button>
          )}
          {syncStatus.failedCount > 0 && (
            <Badge variant="destructive">
              {syncStatus.failedCount} fehlgeschlagen
            </Badge>
          )}
        </div>
      </div>

      {/* Quick actions grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catActions]) => (
            <section key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", CATEGORY_COLORS[category] ?? "text-muted-foreground bg-muted")}>
                  {CATEGORY_LABELS[category] ?? category}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {catActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    isOnline={isOnline}
                    onClick={() => navigate(`/action/${action.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {filteredActions.length === 0 && !isLoading && (
        <div className="text-center py-16 space-y-2">
          <Zap className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Keine Aktionen verfügbar</p>
          <p className="text-xs text-muted-foreground">Bitte wenden Sie sich an Ihren Administrator.</p>
        </div>
      )}
    </div>
  );
}

interface ActionCardProps {
  action: ActionDefinition;
  isOnline: boolean;
  onClick: () => void;
}

function ActionCard({ action, isOnline, onClick }: ActionCardProps) {
  const Icon = ICON_MAP[action.icon] ?? Zap;
  const colorClass = CATEGORY_COLORS[action.category] ?? "text-primary bg-primary/10";
  const isOfflineDisabled = !isOnline && action.offlineBehavior === "reject";

  return (
    <button
      onClick={onClick}
      disabled={isOfflineDisabled}
      className={cn(
        "group relative flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4",
        "hover:border-primary/30 hover:bg-card/80 hover:shadow-md hover:shadow-primary/5",
        "transition-all duration-200 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isOfflineDisabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {action.displayName}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {action.description}
        </p>
      </div>

      <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />

      {!isOnline && action.offlineBehavior === "queue" && (
        <span className="absolute top-2 right-2">
          <Badge variant="warning" className="text-[10px] px-1 py-0">Offline</Badge>
        </span>
      )}
    </button>
  );
}

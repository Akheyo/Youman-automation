import { useToast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ICONS = {
  success: <CheckCircle className="h-4 w-4 text-success" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  info: <Info className="h-4 w-4 text-primary" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-card p-4 shadow-xl pointer-events-auto animate-scale-in",
            "transition-all duration-300"
          )}
        >
          {ICONS[toast.variant ?? "info"]}
          <div className="flex-1 min-w-0">
            {toast.title && <p className="text-sm font-semibold text-foreground">{toast.title}</p>}
            {toast.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

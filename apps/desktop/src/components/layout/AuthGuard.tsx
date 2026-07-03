import { useEffect, useState } from "react";
import { Loader2, ServerCrash } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { attemptAutoLogin } from "@/services/autoLogin";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Auth wrapper for the app shell. On mount, if there's no active session, it
 * silently runs the auto-login flow. The manual login screen is only shown as
 * a fallback when auto-login fails (typically: backend unreachable).
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<"idle" | "logging-in" | "failed">(
    isAuthenticated && accessToken ? "idle" : "logging-in",
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("logging-in");
    void (async () => {
      const ok = await attemptAutoLogin();
      if (cancelled) return;
      setStatus(ok ? "idle" : "failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  if (isAuthenticated && accessToken) return <>{children}</>;

  if (status === "logging-in") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Wird gestartet…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full space-y-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <ServerCrash className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">Backend nicht erreichbar</p>
          <p className="text-sm text-muted-foreground mt-1">
            Der Server unter der konfigurierten URL antwortet nicht. Bitte prüfen
            Sie die Serverkonfiguration oder melden Sie sich manuell an.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate("/settings")}>
            Server-Einstellungen
          </Button>
          <Button onClick={() => navigate("/login")}>
            Manuell anmelden
          </Button>
        </div>
      </div>
    </div>
  );
}

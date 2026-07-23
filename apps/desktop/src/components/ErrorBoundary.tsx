import React from "react";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Bereichsname für die Meldung, z. B. "Aktionsformular". */
  section?: string | undefined;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Fehlergrenze: fängt Renderfehler ab, protokolliert sie und zeigt eine
 * deutsche Fallback-UI mit "Erneut versuchen" und "Zurück zum Dashboard".
 * Eingesetzt einmal um die gesamte App und zusätzlich um jeden Hauptbereich –
 * ein Renderfehler im Formular betrifft damit nur das Formular, nie die App.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Protokollieren mit Komponenten-Stack – landet in der DevTools-Konsole
    // und (über die globalen Handler) im Fehler-Log.
    console.error(
      `[ErrorBoundary${this.props.section ? `:${this.props.section}` : ""}]`,
      error,
      info.componentStack
    );
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  private handleGoToDashboard = (): void => {
    // Hash-Navigation funktioniert ohne Router-Hooks (Klassenkomponente) und
    // auch dann, wenn der Router-Kontext selbst betroffen ist.
    window.location.hash = "#/dashboard";
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const correlationId = extractCorrelationId(error);
    const section = this.props.section;

    return (
      <div className="flex items-center justify-center min-h-[16rem] p-6">
        <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {section
                ? `Im Bereich „${section}" ist ein Fehler aufgetreten.`
                : "Es ist ein unerwarteter Fehler aufgetreten."}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ihre übrigen Daten sind nicht betroffen. Sie können es erneut versuchen
              oder zum Dashboard zurückkehren.
            </p>
            {correlationId && (
              <p className="text-xs text-muted-foreground/80 font-mono">Kennung: {correlationId}</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={this.handleRetry} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Erneut versuchen
            </Button>
            <Button variant="outline" onClick={this.handleGoToDashboard} className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Zurück zum Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/** Liest eine correlationId aus Fehlerobjekten des Backends, falls vorhanden. */
function extractCorrelationId(err: unknown): string | undefined {
  const candidates = [
    (err as { correlationId?: unknown } | null)?.correlationId,
    (err as { response?: { data?: { error?: { correlationId?: unknown } } } } | null)?.response?.data?.error
      ?.correlationId,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return undefined;
}

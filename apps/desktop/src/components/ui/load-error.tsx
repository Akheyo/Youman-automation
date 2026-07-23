import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Einheitlicher Fehlerzustand für fehlgeschlagene Datenladungen.
 * Unsichtbar-Regel: Ein Screen darf NIE mit leeren Daten so tun, als wäre
 * alles normal ("Keine Einträge", leeres Dropdown, Default-Werte), wenn in
 * Wahrheit der Ladevorgang gescheitert ist.
 */
export function LoadErrorNotice({
  what,
  onRetry,
  compact = false,
}: {
  /** Was nicht geladen werden konnte, z. B. "Die Aktionen". */
  what: string;
  onRetry: () => void;
  /** Kompakte Variante für Panels/Inline-Bereiche. */
  compact?: boolean | undefined;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3"
          : "rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3 max-w-md mx-auto my-8"
      }
    >
      <AlertTriangle className={compact ? "h-4 w-4 text-destructive shrink-0" : "h-8 w-8 text-destructive mx-auto"} />
      <p className={compact ? "text-sm text-foreground flex-1" : "text-sm text-foreground"}>
        {what} konnte{what.trim().endsWith("en") ? "n" : ""} nicht geladen werden. Der Server ist möglicherweise
        gerade nicht erreichbar.
      </p>
      <Button size="sm" variant={compact ? "outline" : "default"} onClick={onRetry} className="gap-1.5 shrink-0">
        <RotateCcw className="h-3.5 w-3.5" />
        Erneut laden
      </Button>
    </div>
  );
}

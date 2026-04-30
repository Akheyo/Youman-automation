import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/useToast";
import { setBackendUrl, getBaseUrl } from "@/services/api";

const COMPILED_DEFAULT = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";

type TestResult = { ok: true; latency: number } | { ok: false; message: string } | null;

export function SettingsScreen() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  useEffect(() => {
    void (async () => {
      const stored = await window.adept?.settings.get("backendUrl");
      setUrl(stored ?? getBaseUrl());
      const v = await window.adept?.app.getVersion();
      setAppVersion(v ?? "");
    })();
  }, []);

  const testConnection = async (target: string) => {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const cleaned = target.trim().replace(/\/$/, "");
      // Hitting the API root returns 404 without auth — that's still a valid
      // sign that the server is reachable. We accept any 2xx/4xx, not 5xx/network.
      await axios.get(cleaned, { timeout: 8000, validateStatus: (s) => s < 500 });
      setTestResult({ ok: true, latency: Math.round(performance.now() - start) });
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.code === "ECONNABORTED"
          ? "Zeitüberschreitung — Server antwortet nicht"
          : axios.isAxiosError(err) && !err.response
          ? "Nicht erreichbar — URL falsch oder Server offline"
          : err instanceof Error
          ? err.message
          : "Unbekannter Fehler";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await setBackendUrl(url);
      toast({ title: "Server-URL gespeichert", description: "Bitte erneut anmelden.", variant: "success" });
      navigate("/login", { replace: true });
    } catch (err) {
      toast({
        title: "Speichern fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    await window.adept?.settings.delete("backendUrl");
    setUrl(COMPILED_DEFAULT);
    setTestResult(null);
    toast({ title: "Auf Standard zurückgesetzt", variant: "success" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6" />
            Server-Konfiguration
          </h1>
          <p className="text-sm text-muted-foreground">
            Geben Sie die URL des adept&-Servers an, mit dem sich diese App verbinden soll.
            Lassen Sie das Feld auf dem Standardwert, wenn Sie die offizielle Cloud nutzen.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Backend-URL
            </label>
            <Input
              type="url"
              placeholder="https://api.adept-suite.com/api/v1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="url"
            />
            <p className="text-xs text-muted-foreground">
              Standard: <code className="text-foreground">{COMPILED_DEFAULT}</code>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection(url)}
              disabled={testing || !url.trim()}
              className="flex-1"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verbindung testen"}
            </Button>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                testResult.ok
                  ? "bg-green-50 text-green-900 border border-green-200"
                  : "bg-red-50 text-red-900 border border-red-200"
              }`}
            >
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Server erreichbar ({testResult.latency} ms)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{testResult.message}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onReset} className="flex-1">
            Standard
          </Button>
          <Button onClick={onSave} disabled={saving || !url.trim()} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
          </Button>
        </div>

        {appVersion && (
          <p className="text-center text-xs text-muted-foreground">App-Version {appVersion}</p>
        )}
      </div>
    </div>
  );
}

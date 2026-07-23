import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Building2, Mail, Lock, Loader2, Server, ChevronRight } from "lucide-react";
import { LoginRequestSchema, type LoginRequestDto } from "@youman/shared";
import { useAuthStore } from "@/stores/authStore";
import { apiClient, getApiBaseUrl, setApiBaseUrl, isCustomApiBaseUrl, consumePostLoginRedirect } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/useToast";
import type { LoginResponse } from "@youman/shared";

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => (isCustomApiBaseUrl() ? getApiBaseUrl() : ""));

  const applyServerUrl = () => {
    const applied = setApiBaseUrl(serverUrl);
    setServerUrl(isCustomApiBaseUrl() ? applied : "");
    toast({
      title: isCustomApiBaseUrl() ? `Server: ${applied}` : "Server: lokaler Standard",
      variant: "success",
    });
  };
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginRequestDto>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: {
      tenantSlug: import.meta.env.DEV ? "demo" : "",
    },
  });

  const onSubmit = async (data: LoginRequestDto) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<LoginResponse>("/auth/login", data);
      const { user, tenant, accessToken, refreshToken } = res.data;
      setAuth(user, tenant, accessToken, refreshToken);
      // Nach Session-Ablauf: zurück an die Stelle, an der der Nutzer war –
      // Formulareingaben liegen dort als Entwurf bereit (kein Datenverlust).
      navigate(consumePostLoginRedirect() ?? "/dashboard", { replace: true });
      toast({ title: `Willkommen, ${user.firstName}!`, variant: "success" });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Login fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.";
      setError("password", { message: msg });
      toast({ title: "Login fehlgeschlagen", description: msg, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-2xl">&amp;</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">adept&amp;</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Business Process Platform
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Mandant
              </label>
              <Input
                icon={<Building2 className="h-4 w-4" />}
                placeholder="z.B. mein-unternehmen"
                autoComplete="organization"
                {...register("tenantSlug")}
                error={errors.tenantSlug?.message}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                E-Mail
              </label>
              <Input
                type="email"
                icon={<Mail className="h-4 w-4" />}
                placeholder="name@firma.de"
                autoComplete="email"
                {...register("email")}
                error={errors.email?.message}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Passwort
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  icon={<Lock className="h-4 w-4" />}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
                  error={errors.password?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={isLoading}>
            {isLoading ? "Anmelden..." : "Anmelden"}
          </Button>
        </form>

        {/* Server settings */}
        <div>
          <button
            type="button"
            onClick={() => setShowServer((v) => !v)}
            className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={showServer ? "h-3 w-3 rotate-90 transition-transform" : "h-3 w-3 transition-transform"} />
            <Server className="h-3 w-3" />
            Server-Einstellungen
            {isCustomApiBaseUrl() && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-success" />}
          </button>
          {showServer && (
            <div className="mt-2 flex gap-2">
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="Leer = lokaler Server (localhost:3001)"
                className="font-mono text-xs"
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="sm" onClick={applyServerUrl} className="shrink-0 h-9">
                Übernehmen
              </Button>
            </div>
          )}
        </div>

        {/* Dev hint */}
        {import.meta.env.DEV && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Demo-Zugänge:</p>
            <p>admin@demo.adept.de / Admin123!</p>
            <p>sales@demo.adept.de / Sales123!</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          adept&amp; · Enterprise Business Platform
        </p>
      </div>
    </div>
  );
}

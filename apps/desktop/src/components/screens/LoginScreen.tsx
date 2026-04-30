import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Building2, Mail, Lock, Loader2 } from "lucide-react";
import { LoginRequestSchema, type LoginRequestDto } from "@youman/shared";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/useToast";
import type { LoginResponse } from "@youman/shared";

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      navigate("/dashboard", { replace: true });
      toast({ title: `Willkommen, ${user.firstName}!`, variant: "success" });
    } catch (err) {
      const e = err as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      const status = e.response?.status;
      const serverMsg = e.response?.data?.error?.message;

      let title = "Login fehlgeschlagen";
      let description = "Bitte prüfen Sie Ihre Zugangsdaten.";

      if (!e.response) {
        // No HTTP response → network / DNS / CORS error
        title = "Server nicht erreichbar";
        description =
          e.code === "ECONNABORTED"
            ? "Die Verbindung hat zu lange gedauert. Bitte erneut versuchen."
            : "Backend nicht erreichbar. Prüfen Sie unter Server-Einstellungen, ob die URL stimmt und der Server läuft.";
      } else if (status === 401) {
        title = "Falsche Zugangsdaten";
        description = "E-Mail oder Passwort ist falsch. Mandant-Slug ebenfalls prüfen.";
      } else if (status === 429) {
        title = "Zu viele Login-Versuche";
        description = "Bitte 60 Sekunden warten, dann erneut versuchen.";
      } else if (status === 404) {
        title = "Falscher Server-Pfad";
        description = "Der Server antwortet, aber der Login-Endpoint fehlt. URL inkl. /api/v1 prüfen.";
      } else if (status && status >= 500) {
        title = "Server-Fehler";
        description = serverMsg ?? "Der Server hat einen internen Fehler. Bitte später erneut versuchen.";
      } else if (serverMsg) {
        description = serverMsg;
      }

      setError("password", { message: description });
      toast({ title, description, variant: "error" });
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

        {/* Dev hint */}
        {import.meta.env.DEV && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Demo-Zugänge:</p>
            <p>admin@demo.adept.de / Admin123!</p>
            <p>sales@demo.adept.de / Sales123!</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            Server-Einstellungen
          </button>
          <p className="text-center text-xs text-muted-foreground">
            adept&amp; · Enterprise Business Platform
          </p>
        </div>
      </div>
    </div>
  );
}

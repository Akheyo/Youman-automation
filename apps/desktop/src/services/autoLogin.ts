import type { LoginResponse } from "@youman/shared";
import { apiClient } from "./api";
import { useAuthStore } from "@/stores/authStore";

/**
 * Auto-login for single-operator deployments. When there is no session,
 * silently POST to /auth/login with the default demo credentials so the user
 * never sees the login screen. Backend auth is untouched — the desktop simply
 * skips the manual sign-in step.
 *
 * Credentials come from Vite env vars if provided (VITE_AUTO_LOGIN_*), else
 * fall back to the seeded demo admin.
 */
const DEFAULT_TENANT =
  (import.meta.env.VITE_AUTO_LOGIN_TENANT as string | undefined) ?? "demo";
const DEFAULT_EMAIL =
  (import.meta.env.VITE_AUTO_LOGIN_EMAIL as string | undefined) ?? "admin@demo.adept.de";
const DEFAULT_PASSWORD =
  (import.meta.env.VITE_AUTO_LOGIN_PASSWORD as string | undefined) ?? "Admin123!";

let inflight: Promise<boolean> | null = null;

/**
 * Attempt an auto-login. Resolves true if the store now has a valid session,
 * false if the backend rejected the credentials or was unreachable. Concurrent
 * callers share a single in-flight request.
 */
export async function attemptAutoLogin(): Promise<boolean> {
  const store = useAuthStore.getState();
  if (store.isAuthenticated && store.accessToken) return true;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await apiClient.post<LoginResponse>("/auth/login", {
        tenantSlug: DEFAULT_TENANT,
        email: DEFAULT_EMAIL,
        password: DEFAULT_PASSWORD,
      });
      const { user, tenant, accessToken, refreshToken } = res.data;
      useAuthStore.getState().setAuth(user, tenant, accessToken, refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

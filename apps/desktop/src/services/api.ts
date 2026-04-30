import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/authStore";
import type { ApiResponse, ApiError } from "@youman/shared";

const SETTINGS_KEY = "backendUrl";
const COMPILED_DEFAULT = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";

/**
 * Resolve the API base URL.
 * Priority: user override (electron settings store) > VITE_API_URL > localhost.
 * The user override lets self-hosted / on-prem customers point at their own server.
 */
async function resolveBaseUrl(): Promise<string> {
  try {
    const stored = await window.adept?.settings.get(SETTINGS_KEY);
    if (stored && stored.trim().length > 0) return stored.trim().replace(/\/$/, "");
  } catch {
    // settings IPC may not exist yet (older Electron build) — fall through
  }
  return COMPILED_DEFAULT;
}

let cachedBaseUrl = COMPILED_DEFAULT;

export async function initApiClient(): Promise<string> {
  cachedBaseUrl = await resolveBaseUrl();
  apiClient.defaults.baseURL = cachedBaseUrl;
  return cachedBaseUrl;
}

export function getBaseUrl(): string {
  return cachedBaseUrl;
}

export async function setBackendUrl(url: string): Promise<void> {
  const cleaned = url.trim().replace(/\/$/, "");
  await window.adept?.settings.set(SETTINGS_KEY, cleaned);
  cachedBaseUrl = cleaned;
  apiClient.defaults.baseURL = cleaned;
}

/**
 * Probe the configured backend's /health endpoint. Returns true if reachable
 * within the timeout. Used by the first-run wizard to decide whether to send
 * the user to the settings screen before the login screen.
 */
export async function pingBackend(timeoutMs = 4000): Promise<boolean> {
  try {
    await axios.get(`${cachedBaseUrl}/health`, {
      timeout: timeoutMs,
      validateStatus: (s) => s < 500,
    });
    return true;
  } catch {
    return false;
  }
}

export const apiClient = axios.create({
  baseURL: COMPILED_DEFAULT,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach access token on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiError>) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(err);
      }

      try {
        const res = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${cachedBaseUrl}/auth/refresh`,
          { refreshToken }
        );
        const { accessToken, refreshToken: newRefresh } = res.data;
        setTokens(accessToken, newRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch {
        logout();
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiResponse<T>>(url, { params });
  return res.data.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiClient.post<ApiResponse<T>>(url, data);
  return res.data.data;
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const res = await apiClient.patch<ApiResponse<T>>(url, data);
  return res.data.data;
}

export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;
    return data?.error?.message ?? err.message ?? "Unbekannter Fehler";
  }
  return err instanceof Error ? err.message : "Unbekannter Fehler";
}

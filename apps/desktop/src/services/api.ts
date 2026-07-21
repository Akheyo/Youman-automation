import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/authStore";
import type { ApiResponse, ApiError } from "@youman/shared";

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";
const SERVER_URL_KEY = "adept.serverUrl";

/** User-configurable backend URL (login screen), falls back to the built-in default. */
export function getApiBaseUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_BASE_URL;
}

/** Persists a custom backend URL; empty input resets to the default. */
export function setApiBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) {
    localStorage.removeItem(SERVER_URL_KEY);
    return DEFAULT_BASE_URL;
  }
  const url = trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
  localStorage.setItem(SERVER_URL_KEY, url);
  return url;
}

export function isCustomApiBaseUrl(): boolean {
  return localStorage.getItem(SERVER_URL_KEY) !== null;
}

export const apiClient = axios.create({
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach access token on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Resolved per request so a changed server URL applies without app restart.
  config.baseURL = getApiBaseUrl();
  // Action configs carry absolute paths ("/api/v1/search/…") while baseURL
  // already ends in /api/v1 – strip the duplicate prefix so requests don't
  // end up at /api/v1/api/v1/… (404).
  if (config.url?.startsWith("/api/v1/")) {
    config.url = config.url.slice("/api/v1".length);
  }
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
          `${getApiBaseUrl()}/auth/refresh`,
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

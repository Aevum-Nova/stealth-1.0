import type { ApiResponse } from "@/types/api";

const FALLBACK_API_URL = "http://localhost:3001/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
const REFRESH_TIMEOUT_MS = 6000;

function apiBase(): string {
  return import.meta.env.VITE_API_URL || FALLBACK_API_URL;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAuthState(): void {
  accessToken = null;
}

export async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    try {
      const response = await fetch(`${apiBase()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        signal: controller.signal
      });

      if (!response.ok) {
        clearAuthState();
        return false;
      }

      const body = (await response.json()) as ApiResponse<{ access_token: string; refresh_token: string }>;
      setAccessToken(body.data.access_token);
      return true;
    } catch {
      clearAuthState();
      return false;
    } finally {
      clearTimeout(timeout);
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function encodeOAuthState(value: Record<string, unknown>): string {
  return btoa(JSON.stringify(value));
}

export function decodeOAuthState(value: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

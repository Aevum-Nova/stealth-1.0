import ky from "ky";

import { attemptTokenRefresh, clearAuthState, getAccessToken } from "@/lib/auth";

/** Base URL for synthesis `/api/v1` (same for ky and streaming chat fetch). */
export const API_V1_PREFIX = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"
).replace(/\/$/, "");

// Store the last request body text so it can be re-sent on 401 retry.
let lastRequestBody: string | null = null;

const api = ky.create({
  prefixUrl: API_V1_PREFIX,
  // Keep UI responsive during backend reloads; fail fast and let queries retry/invalidate.
  timeout: 15_000,
  credentials: "include",
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = getAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
        // Cache the body text for potential 401 retry
        lastRequestBody = null;
        if (request.method !== "GET" && request.method !== "HEAD") {
          try {
            lastRequestBody = await request.clone().text();
          } catch {
            // ignore
          }
        }
      }
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) {
          return response;
        }

        const requestUrl = new URL(request.url);
        if (
          requestUrl.pathname.endsWith("/auth/login") ||
          requestUrl.pathname.endsWith("/auth/register") ||
          requestUrl.pathname.endsWith("/auth/google") ||
          requestUrl.pathname.endsWith("/auth/refresh")
        ) {
          return response;
        }

        if (request.headers.get("x-auth-retried") === "true") {
          clearAuthState();
          window.location.href = "/login";
          return response;
        }

        const refreshed = await attemptTokenRefresh();
        if (!refreshed) {
          clearAuthState();
          window.location.href = "/login";
          return response;
        }

        const retryHeaders = new Headers(request.headers);
        retryHeaders.set("x-auth-retried", "true");
        const token = getAccessToken();
        if (token) {
          retryHeaders.set("Authorization", `Bearer ${token}`);
        }

        return ky(request.url, {
          method: request.method,
          headers: retryHeaders,
          body: lastRequestBody,
          credentials: "include"
        });
      }
    ]
  }
});

export default api;

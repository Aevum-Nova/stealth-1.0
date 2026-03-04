import ky from "ky";

import { attemptTokenRefresh, clearAuthState, getAccessToken } from "@/lib/auth";

const agentApi = ky.create({
  prefixUrl: import.meta.env.VITE_AGENT_URL || "http://localhost:3002/api/v1",
  timeout: 60_000,
  credentials: "include",
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      }
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status !== 401) {
          return response;
        }

        const requestUrl = new URL(request.url);
        if (requestUrl.pathname.endsWith("/auth/refresh")) {
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
          ...options,
          headers: retryHeaders,
          credentials: "include"
        });
      }
    ]
  }
});

export default agentApi;

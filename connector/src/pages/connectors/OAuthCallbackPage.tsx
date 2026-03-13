import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { postConnectorOAuthCallback, postOAuthComplete } from "@/api/connectors";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { decodeOAuthState } from "@/lib/auth";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  useEffect(() => {
    async function run() {
      if (!code || !state) {
        setError("Missing OAuth callback parameters.");
        return;
      }

      const parsedState = decodeOAuthState(state);
      const connectorType = String(parsedState.connector_type || "");
      const connectorName = String(parsedState.connector_name || connectorType);
      const returnUrl = String(parsedState.return_url || "/connectors");
      const existingConnectorId = parsedState.connector_id
        ? String(parsedState.connector_id)
        : null;

      if (!connectorType) {
        setError("Invalid OAuth state payload.");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/oauth/callback`;
        let connectorId: string;

        if (existingConnectorId) {
          // BYOC flow: connector already exists with user-provided credentials
          await postConnectorOAuthCallback(existingConnectorId, code, redirectUri);
          connectorId = existingConnectorId;
        } else {
          // Standard flow: platform credentials
          const result = await postOAuthComplete(connectorType, connectorName, code, redirectUri);
          connectorId = result.data.id;
        }

        const separator = returnUrl.includes("?") ? "&" : "?";
        navigate(`${returnUrl}${separator}connectorId=${connectorId}`, { replace: true });
      } catch (err) {
        console.error("OAuth complete failed:", err);
        const message =
          err instanceof Error ? err.message : "OAuth authorization failed. Please try again.";
        setError(message);
      }
    }

    void run();
  }, [code, navigate, state]);

  if (!code && !state && !error) {
    return <Navigate to="/connectors" replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <div className="panel elevated w-full p-8 text-center">
        {error ? (
          <>
            <h1 className="text-2xl">Authorization Failed</h1>
            <p className="mt-2 text-[var(--ink-soft)]">{error}</p>
            <button
              className="mt-4 rounded-lg bg-[var(--ink)] px-4 py-2 text-white"
              onClick={() => navigate("/connectors", { replace: true })}
            >
              Back to Connectors
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl">Completing Authorization</h1>
            <div className="mt-4 flex justify-center">
              <LoadingSpinner label="Finalizing connector" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

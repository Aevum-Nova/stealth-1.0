import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { postConnectorOAuthCallback } from "@/api/connectors";
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
      const connectorId = String(parsedState.connector_id || "");
      const returnUrl = String(parsedState.return_url || "/connectors");

      if (!connectorId) {
        setError("Invalid OAuth state payload.");
        return;
      }

      try {
        await postConnectorOAuthCallback(connectorId, code, `${window.location.origin}/oauth/callback`);
        navigate(returnUrl, { replace: true });
      } catch {
        setError("OAuth callback failed. Please retry connection.");
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

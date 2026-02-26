import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  createConnector,
  getConnector,
  getConnectorAuthUrl,
  getConnectorCatalog,
  updateConnector
} from "@/api/connectors";
import ConnectorConfigForm from "@/components/connectors/ConnectorConfigForm";
import OAuthButton from "@/components/connectors/OAuthButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { encodeOAuthState } from "@/lib/auth";

export default function ConnectorSetupPage() {
  const { type = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [connectorId, setConnectorId] = useState<string | null>(searchParams.get("connectorId"));
  const [authorized, setAuthorized] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<any[] | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await getConnectorCatalog();
      setCatalog(response.data);
    })();
  }, []);

  const item = catalog?.find((entry) => entry.type === type);

  useEffect(() => {
    if (!connectorId) {
      setAuthorized(false);
      return;
    }

    void (async () => {
      try {
        const response = await getConnector(connectorId);
        const creds = response.data.credentials ?? {};
        setAuthorized(Object.keys(creds).length > 0);
      } catch {
        setAuthorized(false);
      }
    })();
  }, [connectorId]);

  if (!item) {
    return <LoadingSpinner label="Loading connector template" />;
  }

  const startOAuth = async () => {
    if (item.available === false) {
      setError("This connector is not configured on the server yet.");
      return;
    }

    setLoading(true);
    setError(null);
    let id = connectorId;

    try {
      if (!id) {
        const created = await createConnector({
          type,
          name: item.display_name,
          enabled: true,
          auto_synthesize: true,
          config: {},
          credentials: {}
        });
        id = created.data.id;
        setConnectorId(id);
      }

      const state = encodeOAuthState({
        connector_id: id,
        return_url: `${window.location.origin}/connectors/new/${type}?connectorId=${id}`
      });
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const auth = await getConnectorAuthUrl(id, redirectUri, state);
      if (!auth.data.auth_url) {
        throw new Error("Backend did not return an auth URL.");
      }
      window.location.href = auth.data.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth start failed");
    } finally {
      setLoading(false);
    }
  };

  const authorizeApiKey = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      let id = connectorId;
      if (!id) {
        const created = await createConnector({
          type,
          name: item.display_name,
          credentials: { api_key: apiKey },
          config: {}
        });
        id = created.data.id;
        setConnectorId(id);
      } else {
        await updateConnector(id, { credentials: { api_key: apiKey } });
      }
      setAuthorized(true);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save API key");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configValues: Record<string, unknown>) => {
    if (!connectorId) {
      setError("Connector must be authorized before configuration.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateConnector(connectorId, { config: configValues, enabled: true });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to="/connectors" className="text-sm text-[var(--accent)]">
          ← Back to Connectors
        </Link>
        <h2 className="mt-1 text-3xl">Set Up {item.display_name}</h2>
      </div>

      <div className="panel elevated p-4">
        {item.available === false ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This connector is not configured on the server.
            {item.missing_env_vars?.length ? ` Missing env vars: ${item.missing_env_vars.join(", ")}` : ""}
          </p>
        ) : null}
        <p className="text-sm text-[var(--ink-soft)]">Step {step} of 3</p>
        {step === 1 ? (
          <div className="mt-3 space-y-4">
            <h3 className="text-lg">Authorize</h3>
            {item.auth_method === "oauth2" ? (
              <OAuthButton label={`Connect with ${item.display_name}`} onClick={startOAuth} disabled={loading} />
            ) : (
              <div className="space-y-2">
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
                  placeholder="Enter API key"
                />
                <button className="rounded-lg bg-[var(--ink)] px-4 py-2 text-white" onClick={() => void authorizeApiKey()}>
                  Save API Key
                </button>
              </div>
            )}
            {connectorId ? (
              <button
                className="rounded-lg border border-[var(--line)] px-3 py-2"
                disabled={item.auth_method === "oauth2" && !authorized}
                onClick={() => setStep(2)}
              >
                Continue to configuration
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-3 space-y-4">
            <h3 className="text-lg">Configure</h3>
            <ConnectorConfigForm catalogItem={item} onSubmit={(values) => void saveConfig(values)} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-3 space-y-3">
            <h3 className="text-lg">Ready</h3>
            <p className="text-[var(--ink-soft)]">Connector is configured. You can open details and trigger the first sync.</p>
            <button
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-white"
              onClick={() => navigate(`/connectors/${connectorId}`)}
            >
              Open Connector
            </button>
          </div>
        ) : null}

        {loading ? <div className="mt-3"><LoadingSpinner label="Working..." /></div> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}

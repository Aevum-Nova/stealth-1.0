import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  createConnector,
  getConnector,
  getConnectorCatalog,
  updateConnector
} from "@/api/connectors";
import ConnectorConfigForm from "@/components/connectors/ConnectorConfigForm";
import SlackChannelPicker from "@/components/connectors/SlackChannelPicker";
import OAuthButton from "@/components/connectors/OAuthButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { startConnectorOAuthFlow, startOAuthFlow } from "@/lib/oauth";

export default function ConnectorSetupPage() {
  const { type = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [connectorId, setConnectorId] = useState<string | null>(searchParams.get("connectorId"));
  const [authorized, setAuthorized] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [byocCredentials, setByocCredentials] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<any[] | null>(null);

  const isSlack = type === "slack";

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
        const isAuth = Object.keys(creds).length > 0;
        setAuthorized(isAuth);

        if (isAuth && step === 1) {
          setStep(2);
        }
      } catch {
        setAuthorized(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectorId]);

  if (!item) {
    return <LoadingSpinner fill label="Loading connector template" />;
  }

  const startOAuth = async () => {
    if (item.available === false) {
      setError("This connector is not configured on the server yet.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await startOAuthFlow(type, item.display_name);
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

  const authorizeByoc = async () => {
    const credentialFields = item.credential_fields ?? [];
    const missing = credentialFields.filter(
      (f: { key: string; required?: boolean }) => f.required && !byocCredentials[f.key]?.trim()
    );
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f: { label: string }) => f.label).join(", ")}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let id = connectorId;
      if (!id) {
        const created = await createConnector({
          type,
          name: item.display_name,
          credentials: byocCredentials,
          config: {},
        });
        id = created.data.id;
        setConnectorId(id);
      } else {
        await updateConnector(id, { credentials: byocCredentials });
      }
      await startConnectorOAuthFlow(id, type, item.display_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth start failed");
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
        <Link to="/connectors" className="text-[13px] text-[var(--accent)]">
          &larr; Back to Connectors
        </Link>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Set Up {item.display_name}</h2>
      </div>

      <div className="panel p-4">
        {item.available === false ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            This connector is not configured on the server.
            {item.missing_env_vars?.length ? ` Missing env vars: ${item.missing_env_vars.join(", ")}` : ""}
          </p>
        ) : null}
        <p className="text-[13px] text-[var(--ink-soft)]">Step {step} of 3</p>

        {/* Step 1: Authorize */}
        {step === 1 ? (
          <div className="mt-3 space-y-4">
            <h3 className="text-[15px] font-medium">Authorize</h3>
            {item.auth_method === "oauth2" ? (
              <OAuthButton label={`Connect with ${item.display_name}`} onClick={startOAuth} disabled={loading} />
            ) : item.auth_method === "oauth2_byoc" ? (
              <div className="space-y-3">
                {(item.credential_fields ?? []).map((field: { key: string; label: string; type?: string; help?: string }) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-[13px] font-medium text-[var(--ink)]">{field.label}</label>
                    <input
                      type={field.type === "password" ? "password" : "text"}
                      value={byocCredentials[field.key] ?? ""}
                      onChange={(e) =>
                        setByocCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                    />
                    {field.help ? (
                      <p className="text-[11px] text-[var(--ink-soft)]">{field.help}</p>
                    ) : null}
                  </div>
                ))}
                <OAuthButton
                  label={`Connect with ${item.display_name}`}
                  onClick={() => void authorizeByoc()}
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
                  placeholder="Enter API key"
                />
                <button className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors" onClick={() => void authorizeApiKey()}>
                  Save API Key
                </button>
              </div>
            )}
            {connectorId ? (
              <button
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
                disabled={(item.auth_method === "oauth2" || item.auth_method === "oauth2_byoc") && !authorized}
                onClick={() => setStep(2)}
              >
                Continue to configuration
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Step 2: Configure */}
        {step === 2 ? (
          <div className="mt-3 space-y-4">
            {isSlack && connectorId ? (
              <>
                <h3 className="text-[15px] font-medium">Select Channels</h3>
                <SlackChannelPicker
                  connectorId={connectorId}
                  saving={loading}
                  onSave={(channelIds, channelNames) => void saveConfig({ channel_ids: channelIds, channel_names: channelNames, include_threads: true, include_images: true, min_message_length: 10 })}
                />
              </>
            ) : (
              <>
                <h3 className="text-[15px] font-medium">Configure</h3>
                <ConnectorConfigForm catalogItem={item} onSubmit={(values) => void saveConfig(values)} />
              </>
            )}
          </div>
        ) : null}

        {/* Step 3: Done */}
        {step === 3 ? (
          <div className="mt-3 space-y-3">
            <h3 className="text-[15px] font-medium">Ready</h3>
            <p className="text-[13px] text-[var(--ink-soft)]">
              Connector is configured. Open it to review bot scope and start creating triggers.
            </p>
            <button
              className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
              onClick={() => navigate(`/connectors/${connectorId}`)}
            >
              Open Connector
            </button>
          </div>
        ) : null}

        {loading ? <div className="mt-3"><LoadingSpinner label="Working..." /></div> : null}
        {error ? <p className="mt-3 text-[13px] text-red-500">{error}</p> : null}
      </div>
    </div>
  );
}

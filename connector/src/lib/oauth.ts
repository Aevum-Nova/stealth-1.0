import { getConnectorAuthUrl, getOAuthStartUrl } from "@/api/connectors";
import { encodeOAuthState } from "@/lib/auth";

/**
 * Kicks off the OAuth flow by redirecting to the provider's authorization page.
 * Uses the generic /oauth-start endpoint (platform credentials).
 */
export async function startOAuthFlow(
  connectorType: string,
  displayName: string,
  returnUrl?: string,
): Promise<void> {
  const state = encodeOAuthState({
    connector_type: connectorType,
    connector_name: displayName,
    return_url: returnUrl ?? `/connectors/new/${connectorType}`,
  });
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const auth = await getOAuthStartUrl(connectorType, redirectUri, state);
  if (!auth.data.auth_url) {
    throw new Error("Backend did not return an auth URL.");
  }
  window.location.href = auth.data.auth_url;
}

/**
 * Kicks off the OAuth flow for a connector that already exists (BYOC flow).
 * Uses the per-connector /connectors/{id}/auth-url endpoint so
 * the connector's own stored credentials (client_id/secret) are used.
 */
export async function startConnectorOAuthFlow(
  connectorId: string,
  connectorType: string,
  displayName: string,
  returnUrl?: string,
): Promise<void> {
  const state = encodeOAuthState({
    connector_type: connectorType,
    connector_name: displayName,
    connector_id: connectorId,
    return_url: returnUrl ?? `/connectors/new/${connectorType}`,
  });
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const auth = await getConnectorAuthUrl(connectorId, redirectUri, state);
  if (!auth.data.auth_url) {
    throw new Error("Backend did not return an auth URL.");
  }
  window.location.href = auth.data.auth_url;
}

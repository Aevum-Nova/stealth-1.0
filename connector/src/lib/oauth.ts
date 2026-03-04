import { getOAuthStartUrl } from "@/api/connectors";
import { encodeOAuthState } from "@/lib/auth";

/**
 * Kicks off the OAuth flow by redirecting to the provider's authorization page.
 * Returns the auth URL on success, or throws on failure.
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

import api from "@/api/client";
import type { ApiResponse } from "@/types/api";
import type { Connector, ConnectorCatalogItem, ConnectorCreatePayload } from "@/types/connector";

export function listConnectors() {
  return api.get("connectors").json<ApiResponse<Connector[]>>();
}

export function getConnector(id: string) {
  return api.get(`connectors/${id}`).json<ApiResponse<Connector>>();
}

export function createConnector(payload: ConnectorCreatePayload) {
  return api.post("connectors", { json: payload }).json<ApiResponse<Connector>>();
}

export function updateConnector(id: string, payload: Partial<ConnectorCreatePayload>) {
  return api.patch(`connectors/${id}`, { json: payload }).json<ApiResponse<Connector>>();
}

export function deleteConnector(id: string) {
  return api.delete(`connectors/${id}`).json<ApiResponse<{ deleted: boolean }>>();
}

export function syncConnector(id: string) {
  return api.post(`connectors/${id}/sync`).json<ApiResponse<{ connector_id: string; status: string; new_signals: number }>>();
}

export function getConnectorCatalog() {
  return api.get("connectors/catalog").json<ApiResponse<ConnectorCatalogItem[]>>();
}

export function getConnectorAuthUrl(id: string, redirectUri: string, state: string) {
  return api
    .get(`connectors/${id}/auth-url`, { searchParams: { redirect_uri: redirectUri, state } })
    .json<ApiResponse<{ auth_url: string | null }>>();
}

export function postConnectorOAuthCallback(id: string, code: string, redirectUri: string) {
  return api
    .post(`connectors/${id}/oauth-callback`, { searchParams: { code, redirect_uri: redirectUri } })
    .json<ApiResponse<{ connector_id: string; connected: boolean }>>();
}

export function getOAuthStartUrl(type: string, redirectUri: string, state: string) {
  return api
    .get("connectors/oauth-start", { searchParams: { type, redirect_uri: redirectUri, state } })
    .json<ApiResponse<{ auth_url: string }>>();
}

export function postOAuthComplete(type: string, name: string, code: string, redirectUri: string) {
  return api
    .post("connectors/oauth-complete", { json: { type, name, code, redirect_uri: redirectUri } })
    .json<ApiResponse<Connector>>();
}

export function getGithubRepos(connectorId: string) {
  return api
    .get(`connectors/${connectorId}/github-repos`)
    .json<ApiResponse<{ full_name: string; default_branch: string; private: boolean; description: string }[]>>();
}

export function getGithubBranches(connectorId: string, repo: string) {
  return api
    .get(`connectors/${connectorId}/github-branches`, { searchParams: { repo } })
    .json<ApiResponse<string[]>>();
}

export function getSlackChannels(connectorId: string) {
  return api
    .get(`connectors/${connectorId}/slack-channels`)
    .json<ApiResponse<{ id: string; name: string; is_private: boolean; num_members: number; topic: string }[]>>();
}

export function joinSlackChannels(connectorId: string, channelIds: string[]) {
  return api
    .post(`connectors/${connectorId}/slack-join-channels`, { json: { channel_ids: channelIds } })
    .json<ApiResponse<Record<string, string>>>();
}

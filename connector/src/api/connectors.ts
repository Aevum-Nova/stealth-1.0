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

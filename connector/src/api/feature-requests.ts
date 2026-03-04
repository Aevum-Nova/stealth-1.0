import api from "@/api/client";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  FeatureRequest,
  FeatureRequestFilters,
  FeatureRequestPatch,
  FeatureRequestImage
} from "@/types/feature-request";
import type { Signal } from "@/types/signal";

export function listFeatureRequests(filters: FeatureRequestFilters = {}) {
  const searchParams: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams[key] = String(value);
    }
  });
  return api.get("feature-requests", { searchParams }).json<PaginatedResponse<FeatureRequest>>();
}

export function getFeatureRequest(id: string) {
  return api.get(`feature-requests/${id}`).json<ApiResponse<FeatureRequest>>();
}

export function patchFeatureRequest(id: string, payload: FeatureRequestPatch) {
  return api.patch(`feature-requests/${id}`, { json: payload }).json<ApiResponse<FeatureRequest>>();
}

export function deleteFeatureRequest(id: string) {
  return api.delete(`feature-requests/${id}`).json<ApiResponse<{ deleted: boolean }>>();
}

export function approveFeatureRequest(id: string) {
  return api.post(`feature-requests/${id}/approve`).json<ApiResponse<{ id: string; status: string }>>();
}

export function rejectFeatureRequest(id: string) {
  return api.post(`feature-requests/${id}/reject`).json<ApiResponse<{ id: string; status: string }>>();
}

export function mergeFeatureRequest(id: string, targetId: string) {
  return api
    .post(`feature-requests/${id}/merge`, { json: { target_id: targetId } })
    .json<ApiResponse<{ merged: boolean; source_id: string; target_id: string }>>();
}

export function sendToAgent(id: string) {
  return api.post(`feature-requests/${id}/send-to-agent`).json<ApiResponse<{ id: string; status: string }>>();
}

export function getFeatureRequestSignals(id: string) {
  return api.get(`feature-requests/${id}/signals`).json<ApiResponse<Signal[]>>();
}

export function getFeatureRequestImages(id: string) {
  return api.get(`feature-requests/${id}/images`).json<
    ApiResponse<
      (FeatureRequestImage & {
        url: string;
      })[]
    >
  >();
}

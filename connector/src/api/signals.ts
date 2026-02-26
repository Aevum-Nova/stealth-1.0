import api from "@/api/client";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type { Signal, SignalFilters } from "@/types/signal";

export function listSignals(filters: SignalFilters = {}) {
  const searchParams: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams[key] = String(value);
    }
  });

  return api.get("signals", { searchParams }).json<PaginatedResponse<Signal>>();
}

export function getSignal(id: string) {
  return api.get(`signals/${id}`).json<ApiResponse<Signal>>();
}

export function deleteSignal(id: string) {
  return api.delete(`signals/${id}`).json<ApiResponse<{ deleted: boolean }>>();
}

export function searchSignals(q: string, limit = 10, threshold = 0.7) {
  return api
    .get("signals/search", { searchParams: { q, limit: String(limit), threshold: String(threshold) } })
    .json<ApiResponse<{ signal: Signal; score: number }[]>>();
}

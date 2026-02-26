import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export interface DashboardStats {
  total_signals: number;
  signals_pending: number;
  signals_failed: number;
  total_feature_requests: number;
  feature_requests_by_status: Record<string, number>;
  feature_requests_by_priority: Record<string, number>;
  active_connectors: number;
  last_synthesis_at: string | null;
  signals_since_last_synthesis: number;
  sources_breakdown: Record<string, number>;
}

export function getDashboardStats() {
  return api.get("dashboard/stats").json<ApiResponse<DashboardStats>>();
}

import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export interface SynthesisRun {
  id: string;
  organization_id: string;
  status: string;
  signal_count: number;
  cluster_count: number;
  feature_request_count: number;
  feature_request_ids: string[];
  model?: string;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export function runSynthesis(mode: "incremental" | "full") {
  return api.post("synthesis/run", { searchParams: { mode } }).json<ApiResponse<{ run_id: string; status: string }>>();
}

export function listSynthesisRuns() {
  return api.get("synthesis/runs").json<ApiResponse<SynthesisRun[]>>();
}

export function getSynthesisRun(id: string) {
  return api.get(`synthesis/runs/${id}`).json<ApiResponse<SynthesisRun>>();
}

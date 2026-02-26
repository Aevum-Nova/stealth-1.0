import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export interface JobSummary {
  id: string;
  type: "ingestion" | "synthesis";
  status: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  total_items?: number;
  processed_items?: number;
  failed_items?: number;
  signal_count?: number;
  cluster_count?: number;
  feature_request_count?: number;
}

export function listJobs() {
  return api.get("jobs").json<ApiResponse<JobSummary[]>>();
}

export function getJob(id: string) {
  return api.get(`jobs/${id}`).json<ApiResponse<Record<string, unknown>>>();
}

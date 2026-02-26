import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export interface TextIngestItem {
  text: string;
  metadata?: Record<string, unknown>;
}

export function ingestText(text: string, metadata: Record<string, unknown> = {}) {
  return api
    .post("ingest/text", {
      json: {
        text,
        source: "api",
        metadata
      }
    })
    .json<ApiResponse<{ signal_id: string; status: string }>>();
}

export function ingestTextBatch(items: TextIngestItem[]) {
  return api
    .post("ingest/text/batch", {
      json: {
        source: "api",
        items
      }
    })
    .json<ApiResponse<{ job_id: string; total_items: number; accepted: number }>>();
}

export function uploadSingleFile(file: File, metadata?: Record<string, unknown>) {
  const body = new FormData();
  body.append("file", file);
  body.append("source", "direct_upload");
  if (metadata && Object.keys(metadata).length > 0) {
    body.append("metadata", JSON.stringify(metadata));
  }
  return api.post("ingest/upload", { body }).json<ApiResponse<{ signal_id: string; status: string }>>();
}

export function uploadBatchFiles(files: File[], metadata?: Record<string, unknown>) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  if (metadata && Object.keys(metadata).length > 0) {
    body.append("metadata", JSON.stringify(metadata));
  }
  return api.post("ingest/upload/batch", { body }).json<
    ApiResponse<{
      job_id: string;
      total_files: number;
      accepted: number;
      rejected: number;
      rejected_reasons: { filename: string; reason: string }[];
    }>
  >();
}

export type SignalSource =
  | "slack"
  | "google_forms"
  | "zendesk"
  | "servicenow"
  | "figma"
  | "granola"
  | "intercom"
  | "direct_upload"
  | "api";

export type SignalDataType = "text" | "audio" | "image";
export type SignalStatus = "pending" | "processing" | "completed" | "failed";
export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type Urgency = "low" | "medium" | "high" | "critical";

export interface SignalEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface Signal {
  id: string;
  status: SignalStatus;
  source: SignalSource;
  source_data_type: SignalDataType;
  raw_artifact_r2_key: string;
  raw_artifact_mime_type: string;
  raw_artifact_size_bytes: number;
  transcript?: string | null;
  extracted_text?: string | null;
  original_text?: string | null;
  structured_summary?: string | null;
  entities: SignalEntity[];
  sentiment?: Sentiment | null;
  urgency?: Urgency | null;
  source_metadata: Record<string, unknown>;
  synthesized: boolean;
  organization_id: string;
  source_created_at?: string | null;
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  processing_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalFilters {
  page?: number;
  limit?: number;
  source?: SignalSource;
  status?: SignalStatus;
  sentiment?: Sentiment;
  urgency?: Urgency;
  synthesized?: boolean;
  since?: string;
  sort?: string;
  order?: "asc" | "desc";
}

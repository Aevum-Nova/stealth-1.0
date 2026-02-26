export type FeatureRequestType = "feature" | "bug_fix" | "improvement" | "integration" | "ux_change";
export type FeatureRequestStatus =
  | "draft"
  | "reviewed"
  | "approved"
  | "rejected"
  | "merged"
  | "sent_to_agent";
export type FeatureRequestPriority = "low" | "medium" | "high" | "critical";

export interface SupportingEvidence {
  signal_id: string;
  signal_summary: string;
  source: string;
  source_data_type: string;
  customer_company?: string | null;
  author_name?: string | null;
  representative_quote: string;
  relevance_score: number;
}

export interface FeatureRequestImage {
  r2_key: string;
  signal_id: string;
  description: string;
  mime_type: string;
}

export interface ImpactMetrics {
  signal_count: number;
  unique_customers: number;
  unique_companies: number;
  source_breakdown: Record<string, number>;
  avg_urgency_score: number;
  avg_sentiment_score: number;
  earliest_mention: string;
  latest_mention: string;
  trend_direction: "increasing" | "stable" | "decreasing" | string;
}

export interface FeatureRequest {
  id: string;
  organization_id: string;
  title: string;
  type: FeatureRequestType;
  status: FeatureRequestStatus;
  priority: FeatureRequestPriority;
  priority_score: number;
  problem_statement: string;
  proposed_solution: string;
  user_story: string;
  acceptance_criteria: string[];
  technical_notes?: string | null;
  affected_product_areas: string[];
  supporting_evidence: SupportingEvidence[];
  images: FeatureRequestImage[];
  impact_metrics?: ImpactMetrics | null;
  synthesis_run_id?: string | null;
  synthesis_model?: string | null;
  synthesis_confidence?: number | null;
  merged_into_id?: string | null;
  human_edited: boolean;
  human_edited_fields: string[];
  human_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureRequestFilters {
  page?: number;
  limit?: number;
  status?: FeatureRequestStatus;
  type?: FeatureRequestType;
  priority?: FeatureRequestPriority;
  min_score?: number;
  signal_id?: string;
  sort?: string;
  order?: "asc" | "desc";
  synthesis_run_id?: string;
}

export interface FeatureRequestPatch {
  title?: string;
  type?: FeatureRequestType;
  priority?: FeatureRequestPriority;
  problem_statement?: string;
  proposed_solution?: string;
  user_story?: string;
  acceptance_criteria?: string[];
  technical_notes?: string;
  affected_product_areas?: string[];
  human_notes?: string;
}

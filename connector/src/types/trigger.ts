export interface TriggerBufferConfig {
  time_threshold_minutes: number;
  count_threshold: number;
  min_buffer_minutes: number;
}

export interface TriggerMatchConfig {
  confidence_threshold: number;
}

export interface TriggerScopeOption {
  label: string;
  value: string;
  description?: string | null;
}

export interface TriggerScopeField {
  key: string;
  label: string;
  type: string;
  multiple: boolean;
  required: boolean;
  help?: string | null;
  options: TriggerScopeOption[];
}

export interface TriggerConnectorOption {
  connector_id: string;
  connector_name: string;
  plugin_type: string;
  display_name: string;
  icon: string;
  adapter_kind: string;
  install_hint?: string | null;
  status: string;
  scope_fields: TriggerScopeField[];
}

export interface TriggerConnectorSummary {
  id: string;
  name: string;
  type: string;
  display_name: string;
  icon: string;
}

export interface TriggerStats {
  matched_events_last_24h: number;
  feature_request_count: number;
  open_buffer_events: number;
}

export interface Trigger {
  id: string;
  connector: TriggerConnectorSummary;
  plugin_type: string;
  natural_language_description: string;
  parsed_filter_criteria: Record<string, unknown>;
  scope: Record<string, unknown>;
  scope_summary: string;
  status: "active" | "paused" | "error" | string;
  buffer_config: TriggerBufferConfig;
  match_config: TriggerMatchConfig;
  stats: TriggerStats;
  last_event_at?: string | null;
  last_dispatch_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerFeatureRequestLink {
  id: string;
  title: string;
}

export interface TriggerActivityEvent {
  id: string;
  external_id: string;
  match_score?: number | null;
  processing_status: string;
  content_text: string;
  source_label: string;
  author_name?: string | null;
  signal_id?: string | null;
  created_at: string;
  processed_at?: string | null;
  feature_requests: TriggerFeatureRequestLink[];
}

export interface TriggerBuffer {
  id: string;
  event_count: number;
  status: string;
  buffer_started_at: string;
  last_event_at?: string | null;
  dispatched_at?: string | null;
  completed_at?: string | null;
  synthesis_run_id?: string | null;
  feature_request_ids: string[];
  error?: string | null;
}

export interface TriggerDetail {
  trigger: Trigger;
  recent_events: TriggerActivityEvent[];
  recent_buffers: TriggerBuffer[];
}

export interface TriggerPayload {
  connector_id: string;
  natural_language_description: string;
  scope: Record<string, unknown>;
  buffer_config: TriggerBufferConfig;
  match_config: TriggerMatchConfig;
  status?: string;
}

export interface TriggerUpdatePayload {
  natural_language_description?: string;
  scope?: Record<string, unknown>;
  buffer_config?: TriggerBufferConfig;
  match_config?: TriggerMatchConfig;
  status?: string;
}

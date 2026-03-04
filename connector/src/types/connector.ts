export interface Connector {
  id: string;
  organization_id: string;
  type: string;
  name: string;
  enabled: boolean;
  auto_synthesize: boolean;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  last_sync_at?: string | null;
  last_sync_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "multi_text" | "multi_select" | "select";
  required?: boolean;
  default?: unknown;
  options?: string[];
  help?: string;
}

export interface ConnectorCatalogItem {
  type: string;
  display_name: string;
  description: string;
  auth_method: "oauth2" | "api_key" | string;
  category: "input" | "output";
  icon: string;
  available?: boolean;
  missing_env_vars?: string[];
  config_fields: ConnectorConfigField[];
}

export interface ConnectorCreatePayload {
  type: string;
  name: string;
  enabled?: boolean;
  auto_synthesize?: boolean;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FeatureRequestType(StrEnum):
    FEATURE = "feature"
    BUG_FIX = "bug_fix"
    IMPROVEMENT = "improvement"
    INTEGRATION = "integration"
    UX_CHANGE = "ux_change"


class FeatureRequestStatus(StrEnum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"
    MERGED = "merged"
    SENT_TO_AGENT = "sent_to_agent"


class FeatureRequestPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SupportingEvidence(BaseModel):
    signal_id: UUID
    signal_summary: str
    source: str
    source_data_type: str
    customer_company: str | None = None
    author_name: str | None = None
    representative_quote: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class FeatureRequestImage(BaseModel):
    r2_key: str
    signal_id: UUID
    description: str
    mime_type: str


class ImpactMetrics(BaseModel):
    signal_count: int
    unique_customers: int
    unique_companies: int
    source_breakdown: dict[str, int]
    avg_urgency_score: float
    avg_sentiment_score: float
    earliest_mention: datetime
    latest_mention: datetime
    trend_direction: str


class FeatureRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    title: str
    type: FeatureRequestType
    status: FeatureRequestStatus
    priority: FeatureRequestPriority
    priority_score: int
    problem_statement: str
    proposed_solution: str
    user_story: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    technical_notes: str | None = None
    affected_product_areas: list[str] = Field(default_factory=list)
    supporting_evidence: list[SupportingEvidence] = Field(default_factory=list)
    images: list[FeatureRequestImage] = Field(default_factory=list)
    impact_metrics: ImpactMetrics | None = None
    synthesis_run_id: UUID | None = None
    synthesis_model: str | None = None
    synthesis_confidence: int | None = None
    synthesis_summary: str | None = None
    merged_into_id: UUID | None = None
    human_edited: bool
    human_edited_fields: list[str] = Field(default_factory=list)
    human_notes: str | None = None
    created_at: datetime
    updated_at: datetime


class FeatureRequestPatch(BaseModel):
    title: str | None = None
    type: FeatureRequestType | None = None
    priority: FeatureRequestPriority | None = None
    problem_statement: str | None = None
    proposed_solution: str | None = None
    user_story: str | None = None
    acceptance_criteria: list[str] | None = None
    technical_notes: str | None = None
    affected_product_areas: list[str] | None = None
    human_notes: str | None = None


class MergeFeatureRequestRequest(BaseModel):
    target_id: UUID


class FeatureRequestImageUrl(BaseModel):
    r2_key: str
    url: str
    signal_id: UUID
    description: str
    mime_type: str

import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import EvidencePanel from "@/components/feature-requests/EvidencePanel";
import FeatureRequestEditor from "@/components/feature-requests/FeatureRequestEditor";
import ImageGallery from "@/components/feature-requests/ImageGallery";
import ImpactMetricsDisplay from "@/components/feature-requests/ImpactMetricsDisplay";
import MergeDialog from "@/components/feature-requests/MergeDialog";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  useFeatureRequest,
  useFeatureRequestActions,
  useFeatureRequestImages,
  useFeatureRequestSignals,
  useFeatureRequests,
  usePatchFeatureRequest
} from "@/hooks/use-feature-requests";

export default function FeatureRequestDetailPage() {
  const { id = "" } = useParams();
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [openMerge, setOpenMerge] = useState(false);

  const featureRequestQuery = useFeatureRequest(id);
  const signalsQuery = useFeatureRequestSignals(id);
  const imagesQuery = useFeatureRequestImages(id);
  const allFeatureRequestsQuery = useFeatureRequests({ limit: 100 });

  const patchMutation = usePatchFeatureRequest(id);
  const actions = useFeatureRequestActions();

  if (featureRequestQuery.isLoading) {
    return <LoadingSpinner label="Loading feature request" />;
  }

  if (featureRequestQuery.isError || !featureRequestQuery.data?.data) {
    return <EmptyState title="Feature request not found" description="This item may have been removed." />;
  }

  const featureRequest = featureRequestQuery.data.data;
  const supportingSignals = signalsQuery.data?.data ?? [];
  const images = imagesQuery.data?.data ?? [];
  const candidates = (allFeatureRequestsQuery.data?.data ?? []).filter((item) => item.id !== featureRequest.id);

  return (
    <div className="space-y-4">
      <Link to="/feature-requests" className="text-[13px] text-[var(--accent)]">
        ← Back to Feature Requests
      </Link>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <section className="panel space-y-3 p-4 xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium">{featureRequest.status}</span>
            <PriorityBadge priority={featureRequest.priority} />
            <span className="text-[12px] text-[var(--ink-soft)]">Score {featureRequest.priority_score}</span>
          </div>

          <FeatureRequestEditor
            featureRequest={featureRequest}
            onSave={async (payload) => {
              await patchMutation.mutateAsync(payload as any);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 transition-colors" onClick={() => setConfirmAction("approve")}>
              Approve
            </button>
            <button className="rounded-lg bg-rose-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-rose-700 transition-colors" onClick={() => setConfirmAction("reject")}>
              Reject
            </button>
            <button className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors" onClick={() => setOpenMerge(true)}>
              Merge
            </button>
            <button
              className="rounded-lg bg-violet-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-violet-700 transition-colors"
              onClick={() => {
                actions.sendToAgent.mutate(featureRequest.id);
              }}
            >
              Send to Agent
            </button>
            <Link
              to={`/feature-requests/${featureRequest.id}/context`}
              className="rounded-lg border border-violet-400 px-3 py-1.5 text-[13px] font-medium text-violet-600 hover:bg-violet-50 transition-colors"
            >
              Product Context
            </Link>
          </div>
        </section>

        <section className="space-y-4 xl:col-span-2">
          <article className="panel p-4">
            <h3 className="mb-2 text-[15px] font-medium">Impact Metrics</h3>
            <ImpactMetricsDisplay metrics={featureRequest.impact_metrics} />
          </article>

          <article className="panel p-4">
            <h3 className="mb-2 text-[15px] font-medium">Images</h3>
            <ImageGallery images={images} />
          </article>

          <article className="panel p-4">
            <h3 className="mb-2 text-[15px] font-medium">Supporting Evidence</h3>
            <EvidencePanel evidence={featureRequest.supporting_evidence} />
            <p className="mt-3 text-[12px] text-[var(--ink-soft)]">Linked signals in panel: {supportingSignals.length}</p>
          </article>

          <article className="panel p-4 text-[13px]">
            <h3 className="mb-2 text-[15px] font-medium">Synthesis Info</h3>
            <p>Model: {featureRequest.synthesis_model ?? "-"}</p>
            <p>Confidence: {featureRequest.synthesis_confidence ?? 0}</p>
            <p>Run: {featureRequest.synthesis_run_id ?? "-"}</p>
            <p>Human edited: {featureRequest.human_edited_fields.join(", ") || "none"}</p>
          </article>
        </section>
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        title="Approve feature request"
        description="Mark this feature request as approved?"
        confirmLabel="Approve"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          actions.approve.mutate(featureRequest.id);
          setConfirmAction(null);
        }}
      />

      <ConfirmDialog
        open={confirmAction === "reject"}
        title="Reject feature request"
        description="Mark this feature request as rejected?"
        confirmLabel="Reject"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          actions.reject.mutate(featureRequest.id);
          setConfirmAction(null);
        }}
      />

      <MergeDialog
        open={openMerge}
        currentId={featureRequest.id}
        candidates={candidates}
        onClose={() => setOpenMerge(false)}
        onMerge={(targetId) => {
          actions.merge.mutate({ id: featureRequest.id, targetId });
          setOpenMerge(false);
        }}
      />
    </div>
  );
}

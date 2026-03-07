import { Link, useParams } from "react-router-dom";

import AgentJobStatus from "@/components/agent/AgentJobStatus";
import ChatPanel from "@/components/agent/ChatPanel";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFeatureRequest } from "@/hooks/use-feature-requests";

export default function ProductContextPage() {
  const { id = "" } = useParams();
  const featureRequestQuery = useFeatureRequest(id);

  if (featureRequestQuery.isLoading) {
    return <LoadingSpinner label="Loading feature request" />;
  }

  if (featureRequestQuery.isError || !featureRequestQuery.data?.data) {
    return <EmptyState title="Feature request not found" description="This item may have been removed." />;
  }

  const fr = featureRequestQuery.data.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={`/feature-requests/${id}`} className="text-[13px] text-[var(--accent)]">
          ← Back to Detail
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left: FR summary + chat */}
        <section className="space-y-4 xl:col-span-2">
          <article className="panel p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold tracking-tight">{fr.title}</h2>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium">{fr.status}</span>
              <PriorityBadge priority={fr.priority} />
            </div>
            <p className="text-[13px] text-[var(--ink-soft)]">{fr.problem_statement}</p>
            {fr.proposed_solution && (
              <div className="mt-2">
                <p className="text-[12px] font-medium text-[var(--ink-soft)]">Proposed Solution</p>
                <p className="text-[13px]">{fr.proposed_solution}</p>
              </div>
            )}
            {fr.user_story && (
              <div className="mt-2">
                <p className="text-[12px] font-medium text-[var(--ink-soft)]">User Story</p>
                <p className="text-[13px]">{fr.user_story}</p>
              </div>
            )}
            {fr.acceptance_criteria.length > 0 && (
              <div className="mt-2">
                <p className="text-[12px] font-medium text-[var(--ink-soft)]">Acceptance Criteria</p>
                <ul className="ml-4 list-disc text-[13px]">
                  {fr.acceptance_criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className="panel flex h-[500px] flex-col">
            <div className="border-b border-[var(--line)] px-4 py-2">
              <h3 className="text-[15px] font-medium">Chat</h3>
            </div>
            <ChatPanel featureRequestId={id} />
          </article>
        </section>

        {/* Right: Agent status */}
        <section className="xl:col-span-1">
          <article className="panel p-4">
            <AgentJobStatus featureRequestId={id} />
          </article>
        </section>
      </div>
    </div>
  );
}

import type { FeatureRequestPriority } from "@/types/feature-request";

const STYLES: Record<FeatureRequestPriority, string> = {
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function PriorityBadge({ priority }: { priority: FeatureRequestPriority }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider ${STYLES[priority]}`}>
      {priority}
    </span>
  );
}

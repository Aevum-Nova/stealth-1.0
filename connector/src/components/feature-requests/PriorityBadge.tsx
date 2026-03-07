import type { FeatureRequestPriority } from "@/types/feature-request";

const CLASS_MAP: Record<FeatureRequestPriority, string> = {
  critical: "bg-rose-100 text-rose-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-emerald-100 text-emerald-800"
};

export default function PriorityBadge({ priority }: { priority: FeatureRequestPriority }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASS_MAP[priority]}`}>{priority.toUpperCase()}</span>;
}

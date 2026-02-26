import type { FeatureRequest } from "@/types/feature-request";

import FeatureRequestCard from "@/components/feature-requests/FeatureRequestCard";

export default function FeatureRequestList({
  items,
  onApprove,
  onReject
}: {
  items: FeatureRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeatureRequestCard key={item.id} featureRequest={item} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  );
}

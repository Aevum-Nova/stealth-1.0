import type { FeatureRequest } from "@/types/feature-request";

import FeatureRequestCard from "@/components/feature-requests/FeatureRequestCard";

export default function FeatureRequestList({
  items,
  onDelete
}: {
  items: FeatureRequest[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeatureRequestCard key={item.id} featureRequest={item} onDelete={onDelete} />
      ))}
    </div>
  );
}

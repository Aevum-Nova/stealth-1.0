import { useQueries } from "@tanstack/react-query";

import type { FeatureRequest } from "@/types/feature-request";
import { getPrStatus } from "@/api/agent";
import { authQueryKey, useAuthQueryScope } from "@/hooks/use-auth-query";

import FeatureRequestCard from "@/components/feature-requests/FeatureRequestCard";

export default function FeatureRequestList({
  items,
  onDelete
}: {
  items: FeatureRequest[];
  onDelete: (id: string) => void;
}) {
  const scope = useAuthQueryScope();
  const statusQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: authQueryKey(scope, "pr-status", item.id),
      queryFn: () => getPrStatus(item.id),
      staleTime: 30_000,
    })),
  });

  const prStatusById = new Map<string, string>();
  statusQueries.forEach((query, idx) => {
    const id = items[idx]?.id;
    const state = query.data?.data?.state;
    const exists = query.data?.data?.exists;
    if (id && exists && state) {
      prStatusById.set(id, state);
    }
  });

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeatureRequestCard
          key={item.id}
          featureRequest={item}
          onDelete={onDelete}
          prStatus={prStatusById.get(item.id)}
        />
      ))}
    </div>
  );
}

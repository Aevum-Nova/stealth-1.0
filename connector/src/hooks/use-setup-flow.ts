import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getDashboardStats } from "@/api/dashboard";
import { useAuthQueryKey } from "@/hooks/use-auth-query";
import { useConnectors } from "@/hooks/use-connectors";
import { useSynthesisRuns } from "@/hooks/use-synthesis";
import { useTriggers } from "@/hooks/use-triggers";
import { deriveSetupFlowState } from "@/lib/setup-flow";

export function useSetupFlow() {
  const statsQueryKey = useAuthQueryKey("dashboard", "stats");
  const connectorsQuery = useConnectors();
  const triggersQuery = useTriggers();
  const runsQuery = useSynthesisRuns();
  const statsQuery = useQuery({
    queryKey: statsQueryKey,
    queryFn: () => getDashboardStats(),
    refetchInterval: 60_000,
  });

  const flow = useMemo(
    () =>
      deriveSetupFlowState({
        connectors: connectorsQuery.data?.data ?? [],
        triggers: triggersQuery.data?.data ?? [],
        signalCount: statsQuery.data?.data.total_signals ?? 0,
        synthesisRunCount: runsQuery.data?.data.length ?? 0,
        featureRequestCount: statsQuery.data?.data.total_feature_requests ?? 0,
      }),
    [connectorsQuery.data, triggersQuery.data, statsQuery.data, runsQuery.data],
  );

  return {
    flow,
    connectorsQuery,
    triggersQuery,
    runsQuery,
    statsQuery,
  };
}

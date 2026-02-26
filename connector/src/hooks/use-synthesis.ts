import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as synthesisApi from "@/api/synthesis";

export function useSynthesisRuns() {
  return useQuery({
    queryKey: ["synthesis-runs"],
    queryFn: () => synthesisApi.listSynthesisRuns(),
    refetchInterval: 10000
  });
}

export function useSynthesisRun(id?: string) {
  return useQuery({
    queryKey: ["synthesis-run", id],
    queryFn: () => synthesisApi.getSynthesisRun(id as string),
    enabled: Boolean(id),
    refetchInterval: 5000
  });
}

export function useRunSynthesis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mode }: { mode: "incremental" | "full" }) => synthesisApi.runSynthesis(mode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["synthesis-runs"] });
    }
  });
}

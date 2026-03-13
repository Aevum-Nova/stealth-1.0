import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as synthesisApi from "@/api/synthesis";
import { useToast } from "@/components/shared/Toast";
import { extractApiErrorMessage } from "@/lib/api-error";

type RunSynthesisVariables = { mode: "incremental" | "full" };
type RunSynthesisResponse = Awaited<ReturnType<typeof synthesisApi.runSynthesis>>;

interface UseRunSynthesisOptions {
  onSuccess?: (response: RunSynthesisResponse, variables: RunSynthesisVariables) => void;
  onError?: (error: unknown, variables: RunSynthesisVariables) => void;
}

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

export function useRunSynthesis(options: UseRunSynthesisOptions = {}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  return useMutation({
    mutationFn: ({ mode }: RunSynthesisVariables) => synthesisApi.runSynthesis(mode),
    onSuccess: async (response, variables) => {
      pushToast({
        tone: "success",
        title: variables.mode === "full" ? "Full synthesis started" : "Synthesis started",
        message: `Run ${response.data.run_id.slice(0, 8)} is ${response.data.status}.`
      });
      await queryClient.invalidateQueries({ queryKey: ["synthesis-runs"] });
      options.onSuccess?.(response, variables);
    },
    onError: async (error, variables) => {
      pushToast({
        tone: "error",
        title: variables.mode === "full" ? "Full synthesis did not start" : "Synthesis did not start",
        message: await extractApiErrorMessage(error, "Could not start synthesis.")
      });
      options.onError?.(error, variables);
    }
  });
}

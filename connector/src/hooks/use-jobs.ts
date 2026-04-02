import { useQuery } from "@tanstack/react-query";

import * as jobsApi from "@/api/jobs";
import { useAuthQueryKey } from "@/hooks/use-auth-query";

export function useJobs() {
  const queryKey = useAuthQueryKey("jobs");

  return useQuery({
    queryKey,
    queryFn: () => jobsApi.listJobs(),
    refetchInterval: 5000
  });
}

export function useJob(id?: string) {
  const queryKey = useAuthQueryKey("job", id);

  return useQuery({
    queryKey,
    queryFn: () => jobsApi.getJob(id as string),
    enabled: Boolean(id),
    refetchInterval: 5000
  });
}

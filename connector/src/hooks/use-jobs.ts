import { useQuery } from "@tanstack/react-query";

import * as jobsApi from "@/api/jobs";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.listJobs(),
    refetchInterval: 5000
  });
}

export function useJob(id?: string) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: () => jobsApi.getJob(id as string),
    enabled: Boolean(id),
    refetchInterval: 5000
  });
}

import { useQuery } from "@tanstack/react-query";

import * as signalsApi from "@/api/signals";
import type { SignalFilters } from "@/types/signal";

export function useSignals(filters: SignalFilters = {}) {
  return useQuery({
    queryKey: ["signals", filters],
    queryFn: () => signalsApi.listSignals(filters)
  });
}

export function useSignal(id?: string) {
  return useQuery({
    queryKey: ["signal", id],
    queryFn: () => signalsApi.getSignal(id as string),
    enabled: Boolean(id)
  });
}

export function useSignalSearch(query: string) {
  return useQuery({
    queryKey: ["signals", "search", query],
    queryFn: () => signalsApi.searchSignals(query),
    enabled: query.trim().length > 0
  });
}

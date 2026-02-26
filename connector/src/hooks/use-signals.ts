import { keepPreviousData, useQuery } from "@tanstack/react-query";

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
  const normalized = query.trim();
  return useQuery({
    queryKey: ["signals", "search", normalized],
    queryFn: () => signalsApi.searchSignals(normalized),
    enabled: normalized.length >= 2,
    placeholderData: keepPreviousData
  });
}

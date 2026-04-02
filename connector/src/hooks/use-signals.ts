import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useAuthQueryKey } from "@/hooks/use-auth-query";
import * as signalsApi from "@/api/signals";
import type { SignalFilters } from "@/types/signal";

export function useSignals(filters: SignalFilters = {}) {
  const queryKey = useAuthQueryKey("signals", filters);

  return useQuery({
    queryKey,
    queryFn: () => signalsApi.listSignals(filters)
  });
}

export function useSignal(id?: string) {
  const queryKey = useAuthQueryKey("signal", id);

  return useQuery({
    queryKey,
    queryFn: () => signalsApi.getSignal(id as string),
    enabled: Boolean(id)
  });
}

export function useSignalSearch(query: string) {
  const normalized = query.trim();
  const queryKey = useAuthQueryKey("signals", "search", normalized);

  return useQuery({
    queryKey,
    queryFn: () => signalsApi.searchSignals(normalized),
    enabled: normalized.length >= 2,
    placeholderData: keepPreviousData
  });
}

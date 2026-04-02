import type { QueryKey } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";

const ANONYMOUS_QUERY_SCOPE = "anonymous";

export function authQueryKey(scope: string, ...parts: readonly unknown[]): QueryKey {
  return ["auth", scope, ...parts];
}

export function useAuthQueryScope(): string {
  const { user } = useAuth();
  return user?.id ?? ANONYMOUS_QUERY_SCOPE;
}

export function useAuthQueryKey(...parts: readonly unknown[]): QueryKey {
  const scope = useAuthQueryScope();
  return authQueryKey(scope, ...parts);
}

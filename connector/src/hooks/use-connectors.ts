import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as connectorsApi from "@/api/connectors";
import { authQueryKey, useAuthQueryKey, useAuthQueryScope } from "@/hooks/use-auth-query";
import type { ConnectorCreatePayload } from "@/types/connector";

export function useConnectors() {
  const queryKey = useAuthQueryKey("connectors");

  return useQuery({
    queryKey,
    queryFn: () => connectorsApi.listConnectors()
  });
}

export function useConnectorCatalog() {
  const queryKey = useAuthQueryKey("connectors", "catalog");

  return useQuery({
    queryKey,
    queryFn: () => connectorsApi.getConnectorCatalog()
  });
}

export function useConnector(id?: string) {
  const queryKey = useAuthQueryKey("connector", id);

  return useQuery({
    queryKey,
    queryFn: () => connectorsApi.getConnector(id as string),
    enabled: Boolean(id)
  });
}

export function useGithubRepos(connectorId?: string) {
  const queryKey = useAuthQueryKey("connector", connectorId, "github-repos");

  return useQuery({
    queryKey,
    queryFn: () => connectorsApi.getGithubRepos(connectorId as string),
    enabled: Boolean(connectorId)
  });
}

export function useGithubBranches(connectorId?: string, repo?: string) {
  const queryKey = useAuthQueryKey("connector", connectorId, "github-branches", repo);

  return useQuery({
    queryKey,
    queryFn: () => connectorsApi.getGithubBranches(connectorId as string, repo as string),
    enabled: Boolean(connectorId && repo)
  });
}

export function useSlackChannels(connectorId?: string) {
  const queryKey = useAuthQueryKey("connector", connectorId, "slack-channels");

  return useQuery({
    queryKey,
    queryFn: () => connectorsApi.getSlackChannels(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useConnectorMutations() {
  const scope = useAuthQueryScope();
  const queryClient = useQueryClient();
  const connectorsKey = authQueryKey(scope, "connectors");

  return {
    createConnector: useMutation({
      mutationFn: (payload: ConnectorCreatePayload) => connectorsApi.createConnector(payload),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: connectorsKey });
      }
    }),
    updateConnector: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<ConnectorCreatePayload> }) =>
        connectorsApi.updateConnector(id, payload),
      onSuccess: async (_data, vars) => {
        await queryClient.invalidateQueries({ queryKey: connectorsKey });
        await queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "connector", vars.id) });
      }
    }),
    syncConnector: useMutation({
      mutationFn: (id: string) => connectorsApi.syncConnector(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: connectorsKey });
      }
    }),
    deleteConnector: useMutation({
      mutationFn: (id: string) => connectorsApi.deleteConnector(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: connectorsKey });
      }
    })
  };
}

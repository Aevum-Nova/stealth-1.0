import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as connectorsApi from "@/api/connectors";
import type { ConnectorCreatePayload } from "@/types/connector";

export function useConnectors() {
  return useQuery({
    queryKey: ["connectors"],
    queryFn: () => connectorsApi.listConnectors()
  });
}

export function useConnectorCatalog() {
  return useQuery({
    queryKey: ["connectors", "catalog"],
    queryFn: () => connectorsApi.getConnectorCatalog()
  });
}

export function useConnector(id?: string) {
  return useQuery({
    queryKey: ["connector", id],
    queryFn: () => connectorsApi.getConnector(id as string),
    enabled: Boolean(id)
  });
}

export function useGithubRepos(connectorId?: string) {
  return useQuery({
    queryKey: ["connector", connectorId, "github-repos"],
    queryFn: () => connectorsApi.getGithubRepos(connectorId as string),
    enabled: Boolean(connectorId)
  });
}

export function useGithubBranches(connectorId?: string, repo?: string) {
  return useQuery({
    queryKey: ["connector", connectorId, "github-branches", repo],
    queryFn: () => connectorsApi.getGithubBranches(connectorId as string, repo as string),
    enabled: Boolean(connectorId && repo)
  });
}

export function useConnectorMutations() {
  const queryClient = useQueryClient();

  return {
    createConnector: useMutation({
      mutationFn: (payload: ConnectorCreatePayload) => connectorsApi.createConnector(payload),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["connectors"] });
      }
    }),
    updateConnector: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<ConnectorCreatePayload> }) =>
        connectorsApi.updateConnector(id, payload),
      onSuccess: async (_data, vars) => {
        await queryClient.invalidateQueries({ queryKey: ["connectors"] });
        await queryClient.invalidateQueries({ queryKey: ["connector", vars.id] });
      }
    }),
    syncConnector: useMutation({
      mutationFn: (id: string) => connectorsApi.syncConnector(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["connectors"] });
      }
    }),
    deleteConnector: useMutation({
      mutationFn: (id: string) => connectorsApi.deleteConnector(id),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["connectors"] });
      }
    })
  };
}

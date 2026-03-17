import api from "@/api/client";
import type { ApiResponse } from "@/types/api";
import type { Trigger, TriggerConnectorOption, TriggerDetail, TriggerPayload, TriggerUpdatePayload } from "@/types/trigger";

export function getTriggerConfig() {
  return api.get("triggers/config").json<ApiResponse<TriggerConnectorOption[]>>();
}

export function listTriggers() {
  return api.get("triggers").json<ApiResponse<Trigger[]>>();
}

export function getTrigger(id: string) {
  return api.get(`triggers/${id}`).json<ApiResponse<TriggerDetail>>();
}

export function createTrigger(payload: TriggerPayload) {
  return api.post("triggers", { json: payload }).json<ApiResponse<Trigger>>();
}

export function updateTrigger(id: string, payload: TriggerUpdatePayload) {
  return api.patch(`triggers/${id}`, { json: payload }).json<ApiResponse<Trigger>>();
}

export function deleteTrigger(id: string) {
  return api.delete(`triggers/${id}`).json<ApiResponse<{ deleted: boolean }>>();
}

export function pauseTrigger(id: string) {
  return api.post(`triggers/${id}/pause`).json<ApiResponse<Trigger>>();
}

export function resumeTrigger(id: string) {
  return api.post(`triggers/${id}/resume`).json<ApiResponse<Trigger>>();
}

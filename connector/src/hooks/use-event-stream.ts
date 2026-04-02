import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authQueryKey, useAuthQueryScope } from "@/hooks/use-auth-query";
import { getAccessToken } from "@/lib/auth";

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

const STREAM_EVENTS = [
  "signal_processed",
  "signal_failed",
  "job_completed",
  "connector_sync_started",
  "connector_sync_completed",
  "synthesis_started",
  "synthesis_progress",
  "synthesis_completed",
  "synthesis_failed"
] as const;

export function useEventStream() {
  const scope = useAuthQueryScope();
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const retriesRef = useRef(0);

  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
      const token = getAccessToken();
      const streamUrl = token ? `${base}/events/stream?access_token=${encodeURIComponent(token)}` : `${base}/events/stream`;
      source = new EventSource(streamUrl, { withCredentials: true });

      source.onopen = () => {
        retriesRef.current = 0;
        setConnected(true);
      };

      STREAM_EVENTS.forEach((eventName) => {
        source?.addEventListener(eventName, (event) => {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          setEvents((prev) => [{ event: eventName, data: payload, timestamp: Date.now() }, ...prev].slice(0, 50));

          if (eventName.startsWith("signal")) {
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "signals") });
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "jobs") });
          }
          if (eventName.includes("connector_sync")) {
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "connectors") });
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "dashboard") });
          }
          if (eventName.startsWith("synthesis")) {
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "synthesis-runs") });
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "feature-requests") });
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "dashboard") });
          }
          if (eventName === "job_completed") {
            void queryClient.invalidateQueries({ queryKey: authQueryKey(scope, "jobs") });
          }
        });
      });

      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;

        if (!closed) {
          const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
          retriesRef.current += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      source?.close();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [queryClient, scope]);

  return {
    connected,
    events
  };
}

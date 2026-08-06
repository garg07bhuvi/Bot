"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchStreamUrl } from "@/lib/api";
import type { AgentLog, Business } from "@/lib/types";

function newLog(log: Omit<AgentLog, "id" | "timestamp">): AgentLog {
  return {
    ...log,
    id: crypto.randomUUID(),
    timestamp: new Date().toLocaleTimeString(),
  };
}

/**
 * Drives the agent's server-sent-events stream: opens it, translates each event
 * into a log entry, and reports saved businesses to the caller.
 */
export function useAgentStream({
  onBusinessSaved,
  onComplete,
}: {
  onBusinessSaved: (business: Business) => void;
  onComplete: () => void;
}) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [searching, setSearching] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const append = useCallback((log: Omit<AgentLog, "id" | "timestamp">) => {
    setLogs((prev) => [...prev, newLog(log)]);
  }, []);

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  // Don't leave a stream open if the component unmounts mid-run.
  useEffect(() => closeStream, [closeStream]);

  const start = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      setLogs([]);
      setSearching(true);
      closeStream();

      const eventSource = new EventSource(searchStreamUrl(query));
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          console.error("SSE parse error", err);
          return;
        }

        switch (data.type) {
          case "business_saved":
            append({ type: "business_saved", message: data.message });
            onBusinessSaved(data.business);
            break;
          case "thought":
            append({
              type: "thought",
              step: data.step,
              thought: data.thought,
              action: data.action,
              parameters: data.parameters,
            });
            break;
          case "log":
            append({ type: "log", message: data.message });
            break;
          case "error":
            append({ type: "error", message: data.message });
            setSearching(false);
            closeStream();
            break;
          case "complete":
            append({ type: "complete", message: data.message });
            setSearching(false);
            closeStream();
            onComplete();
            break;
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE Error:", err);
        append({
          type: "error",
          message: "Server Connection Lost. Backend API might be offline.",
        });
        setSearching(false);
        closeStream();
      };
    },
    [append, closeStream, onBusinessSaved, onComplete]
  );

  const stop = useCallback(() => {
    if (!eventSourceRef.current) return;
    closeStream();
    append({
      type: "log",
      message: "⏹️ Agent execution manually stopped by user.",
    });
    setSearching(false);
  }, [append, closeStream]);

  return { logs, searching, start, stop };
}

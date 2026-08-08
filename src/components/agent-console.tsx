"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentLog } from "@/lib/types";

function LogEntry({ log }: { log: AgentLog }) {
  if (log.type === "thought") {
    return (
      <div className="bg-[var(--secondary)] border-l-2 border-[var(--primary)] rounded-r-md p-3 space-y-2">
        <div className="flex items-center justify-between text-[var(--primary)] font-semibold border-b border-[var(--border)] pb-1 text-[11px] tracking-wide">
          <span>AGENT THOUGHT · STEP {log.step}</span>
          <span className="text-[var(--muted-foreground)]">{log.timestamp}</span>
        </div>
        <p className="text-[var(--foreground)] leading-relaxed text-[12px] font-sans italic">
          &quot;{log.thought}&quot;
        </p>
        <div className="text-[11px] text-[#a84e35] mt-1 pt-1 border-t border-[var(--border)]">
          <span className="text-[var(--muted-foreground)]">next_action:</span> {log.action}(
          {JSON.stringify(log.parameters)})
        </div>
      </div>
    );
  }

  if (log.type === "business_saved") {
    return (
      <div className="bg-[var(--secondary)] border-l-2 border-emerald-600 rounded-r-md p-3 text-[12px] text-[var(--foreground)]">
        <div className="font-semibold text-emerald-700 mb-1 text-[11px] tracking-wide">SAVED</div>
        {log.message}
      </div>
    );
  }

  if (log.type === "error") {
    return (
      <div className="bg-[var(--secondary)] border-l-2 border-[var(--destructive)] rounded-r-md p-3 text-[12px] text-[#8f3323]">
        <span className="font-semibold text-[var(--destructive)]">ERROR</span> — {log.message}
      </div>
    );
  }

  if (log.type === "complete") {
    return (
      <div className="bg-[var(--secondary)] border-l-2 border-[var(--primary)] rounded-r-md p-3 text-center font-semibold text-[12px] text-[var(--primary)]">
        {log.message}
      </div>
    );
  }

  return (
    <div className="text-[var(--muted-foreground)] flex items-start space-x-2 text-[12px]">
      <span className="text-[var(--muted-foreground)]/70">[{log.timestamp}]</span>
      <span className="flex-1 leading-normal">{log.message}</span>
    </div>
  );
}

export function AgentConsole({
  logs,
  searching,
}: {
  logs: AgentLog[];
  searching: boolean;
}) {
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // A fresh run always surfaces the console, even if the user collapsed the last one.
  // Adjusting state during render (React's documented pattern for this) avoids an extra effect-triggered render.
  const [prevSearching, setPrevSearching] = useState(searching);
  if (searching !== prevSearching) {
    setPrevSearching(searching);
    if (searching) setCollapsed(false);
  }

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, collapsed]);

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="bg-[var(--secondary)] px-4 py-2 border-b border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)] font-mono w-full cursor-pointer"
        aria-expanded={!collapsed}
      >
        <span className="font-semibold text-[var(--foreground)]">agent_console.log</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${searching ? "bg-emerald-600" : "bg-[var(--muted-foreground)]/50"}`}
            />
            {searching ? "ACTIVE" : "IDLE"}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-3.5 h-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="max-h-80 bg-[var(--card)] p-4 overflow-y-auto font-mono text-xs space-y-3">
          {logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
          <div ref={consoleEndRef} />
        </div>
      )}
    </div>
  );
}

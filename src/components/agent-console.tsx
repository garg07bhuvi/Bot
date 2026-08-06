"use client";

import { useEffect, useRef } from "react";
import type { AgentLog } from "@/lib/types";

function LogEntry({ log }: { log: AgentLog }) {
  if (log.type === "thought") {
    return (
      <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-purple-400 font-semibold border-b border-purple-500/10 pb-1 text-[10px]">
          <span className="flex items-center">
            <span className="mr-1">🧠</span> AGENT THOUGHT (Step {log.step})
          </span>
          <span>{log.timestamp}</span>
        </div>
        <p className="text-purple-100/90 leading-relaxed text-[11px] font-sans italic">
          &quot;{log.thought}&quot;
        </p>
        <div className="text-[10px] text-indigo-300 font-mono mt-1 pt-1 border-t border-purple-500/5">
          <span className="text-zinc-500">Next Action:</span> {log.action}(
          {JSON.stringify(log.parameters)})
        </div>
      </div>
    );
  }

  if (log.type === "business_saved") {
    return (
      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 text-[11px] text-emerald-200">
        <div className="font-semibold text-emerald-400 flex items-center mb-1">
          <span className="mr-1">🎉</span> DATABASE STORAGE TRIGGERED
        </div>
        {log.message}
      </div>
    );
  }

  if (log.type === "error") {
    return (
      <div className="text-rose-400 bg-rose-950/20 border border-rose-500/20 rounded-lg p-2.5">
        <span className="font-semibold">❌ ERROR:</span> {log.message}
      </div>
    );
  }

  if (log.type === "complete") {
    return (
      <div className="text-purple-300 bg-purple-600/10 border border-purple-500/30 rounded-lg p-3 text-center font-semibold">
        🏆 {log.message}
      </div>
    );
  }

  return (
    <div className="text-zinc-400 flex items-start space-x-2 text-[11px]">
      <span className="text-zinc-600">[{log.timestamp}]</span>
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

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex-1 glass-panel rounded-2xl border-zinc-800/80 overflow-hidden flex flex-col scanline relative">
      <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-900 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-2 font-semibold">agent_console.log</span>
        </div>
        <div>{searching ? "STATUS: ACTIVE" : "STATUS: IDLE"}</div>
      </div>

      <div className="flex-1 bg-zinc-950/80 p-4 overflow-y-auto font-mono text-xs space-y-4">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-10 h-10 mb-2 opacity-40 text-purple-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
              />
            </svg>
            <p>Awaiting Scout query parameters...</p>
            <p className="text-[10px] mt-1 text-zinc-700">
              Logs and thoughts will stream here live
            </p>
          </div>
        ) : (
          logs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}

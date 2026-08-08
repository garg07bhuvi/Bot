"use client";

import type { ReactNode } from "react";
import type { BackendStatus } from "@/lib/types";

export function DashboardHeader({
  status,
  onOpenSettings,
  brand,
}: {
  status: BackendStatus | null;
  onOpenSettings: () => void;
  /** Static branding, rendered on the server and passed through as children. */
  brand: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
      {brand}

      <div className="flex items-center space-x-3">
        {status && (
          <div className="hidden md:flex items-center divide-x divide-[var(--border)] bg-[var(--secondary)] rounded-lg border border-[var(--border)] text-xs overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${status.database.connected_to_mongodb ? "bg-emerald-600" : "bg-amber-600"}`}
              />
              <span className="text-[var(--muted-foreground)]">Database</span>
              <span className="text-[var(--foreground)] font-medium">
                {status.database.connected_to_mongodb ? "MongoDB" : "JSON Fallback"}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${status.config.openrouter_api_key_configured ? "bg-emerald-600" : "bg-[var(--destructive)]"}`}
              />
              <span className="text-[var(--muted-foreground)]">OpenRouter</span>
              <span className="text-[var(--foreground)] font-medium">
                {status.config.openrouter_api_key_configured ? "Connected" : "Key Missing"}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2">
              <span className="text-[var(--muted-foreground)]">Search</span>
              <span className="text-[var(--primary)] font-semibold uppercase tracking-wide">
                {status.config.search_provider}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={onOpenSettings}
          aria-label="Open agent settings"
          className="p-2.5 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg transition duration-150 border border-[var(--border)] cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.936 6.936 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

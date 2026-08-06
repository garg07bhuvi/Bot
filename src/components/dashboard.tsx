"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AgentConsole } from "@/components/agent-console";
import { BusinessGrid } from "@/components/business-grid";
import { DashboardHeader } from "@/components/dashboard-header";
import { ScoutForm } from "@/components/scout-form";
import { SettingsModal } from "@/components/settings-modal";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { fetchBusinesses, fetchStatus } from "@/lib/api";
import type { BackendStatus, Business, SettingsForm } from "@/lib/types";

/** Swallows the abort that a cancelled effect triggers; logs anything real. */
function ignoreAbort(context: string) {
  return (err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error(`${context}:`, err);
  };
}

/** API keys are never echoed back into the form — blanks mean "keep current". */
function settingsFormFor(status: BackendStatus): SettingsForm {
  return {
    openrouter_api_key: "",
    mongodb_uri: status.database.connected_to_mongodb ? "" : "mongodb://localhost:27017",
    search_provider: status.config.search_provider,
    google_places_api_key: "",
    serper_api_key: "",
  };
}

export function Dashboard({ brand }: { brand: ReactNode }) {
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchStatus());
    } catch (e) {
      console.error("Error fetching backend status:", e);
    }
  }, []);

  const loadBusinesses = useCallback(async () => {
    try {
      setBusinesses(await fetchBusinesses());
    } catch (e) {
      console.error("Error fetching businesses:", e);
    }
  }, []);

  // Initial load from the backend. Both requests are independent, so they run
  // in parallel and each survives the other failing.
  useEffect(() => {
    const controller = new AbortController();

    void fetchStatus(controller.signal)
      .then(setStatus)
      .catch(ignoreAbort("Error fetching backend status"));

    void fetchBusinesses(controller.signal)
      .then(setBusinesses)
      .catch(ignoreAbort("Error fetching businesses"));

    return () => controller.abort();
  }, []);

  const addBusiness = useCallback((business: Business) => {
    setBusinesses((prev) =>
      prev.some((b) => b.place_id === business.place_id)
        ? prev
        : [business, ...prev]
    );
  }, []);

  const { logs, searching, start, stop } = useAgentStream({
    onBusinessSaved: addBusiness,
    onComplete: loadBusinesses,
  });

  const handleStart = (e: FormEvent) => {
    e.preventDefault();
    start(query);
  };

  const showConsole = searching || logs.length > 0;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col antialiased">
      <DashboardHeader
        status={status}
        onOpenSettings={() => setShowSettings(true)}
        brand={brand}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 flex flex-col gap-5">
        <ScoutForm
          query={query}
          onQueryChange={setQuery}
          searching={searching}
          onStart={handleStart}
          onStop={stop}
        />

        {showConsole && <AgentConsole logs={logs} searching={searching} />}

        <BusinessGrid businesses={businesses} />
      </main>

      {showSettings && status && (
        <SettingsModal
          initialForm={settingsFormFor(status)}
          onClose={() => setShowSettings(false)}
          onSaved={loadStatus}
        />
      )}

      <footer className="md:hidden glass-panel border-t border-[var(--border)] py-2.5 px-4 text-[11px] text-[var(--muted-foreground)] flex items-center justify-between mt-auto">
        <span>Aura Business Scout 1.0</span>
        {status && (
          <span className="flex items-center">
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.database.connected_to_mongodb ? "bg-emerald-600" : "bg-amber-600"}`}
            />
            {status.database.connected_to_mongodb ? "MongoDB Online" : "JSON Fallback"}
          </span>
        )}
      </footer>
    </div>
  );
}

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
    gemini_api_key: "",
    mongodb_uri: status.database.connected_to_mongodb
      ? ""
      : "mongodb://localhost:27017",
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

  return (
    <div className="relative min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col antialiased">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/15 rounded-full filter blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/10 rounded-full filter blur-[120px] animate-pulse-slow pointer-events-none" />

      <DashboardHeader
        status={status}
        onOpenSettings={() => setShowSettings(true)}
        brand={brand}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        <section className="lg:col-span-5 flex flex-col space-y-6 max-h-[calc(100vh-130px)]">
          <ScoutForm
            query={query}
            onQueryChange={setQuery}
            searching={searching}
            onStart={handleStart}
            onStop={stop}
          />
          <AgentConsole logs={logs} searching={searching} />
        </section>

        <BusinessGrid businesses={businesses} />
      </main>

      {showSettings && status && (
        <SettingsModal
          initialForm={settingsFormFor(status)}
          onClose={() => setShowSettings(false)}
          onSaved={loadStatus}
        />
      )}

      <footer className="md:hidden glass-panel border-t border-zinc-850 py-2.5 px-4 text-[10px] text-zinc-500 flex items-center justify-between mt-auto">
        <span>Aura Business Scout 1.0</span>
        {status && (
          <span className="flex items-center">
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.database.connected_to_mongodb ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {status.database.connected_to_mongodb
              ? "MongoDB Online"
              : "JSON Fallback"}
          </span>
        )}
      </footer>
    </div>
  );
}

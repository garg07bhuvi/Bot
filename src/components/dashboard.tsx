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
    leapcrew_api_key: "",
  };
}

export function Dashboard({ brand }: { brand: ReactNode }) {
  const [query, setQuery] = useState("");
  const [savedBusinesses, setSavedBusinesses] = useState<Business[]>([]);
  const [scoutedBusinesses, setScoutedBusinesses] = useState<Business[]>([]);
  const [activeTab, setActiveTab] = useState<"saved" | "scouted">("saved");
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "info" | "error" }[]>([]);

  const showToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchStatus());
    } catch (e) {
      console.error("Error fetching backend status:", e);
    }
  }, []);

  const loadBusinesses = useCallback(async () => {
    try {
      setSavedBusinesses(await fetchBusinesses());
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
      .then(setSavedBusinesses)
      .catch(ignoreAbort("Error fetching businesses"));

    return () => controller.abort();
  }, []);

  const addBusiness = useCallback((business: any) => {
    if (business.autoSaved) {
      setSavedBusinesses((prev) => {
        const alreadyExists = prev.some((b) => b.place_id === business.place_id);
        if (!alreadyExists) return [business, ...prev];
        return prev;
      });
      showToast(`Auto-saved "${business.name}" (website, phone & location verified)`, "success");
    }

    setScoutedBusinesses((prev) => {
      const alreadyExists = prev.some((b) => b.place_id === business.place_id);
      if (!alreadyExists) {
        if (!business.autoSaved) {
          showToast(`Discovered "${business.name}"`, "info");
        }
        return [business, ...prev];
      }
      return prev;
    });
  }, [showToast]);

  const handleSaveBusiness = useCallback(async (business: Business) => {
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(business),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save business");

      showToast(`Added "${business.name}" to database`, "success");
      await loadBusinesses();
    } catch (err) {
      console.error(err);
      showToast(`Failed to save: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [loadBusinesses, showToast]);

  const { logs, searching, start, stop } = useAgentStream({
    onBusinessSaved: addBusiness,
    onComplete: loadBusinesses,
  });

  const handleStart = (e: FormEvent) => {
    e.preventDefault();
    setScoutedBusinesses([]);
    setActiveTab("scouted");
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

        {/* Tab Selection Controls */}
        <div className="flex border-b border-[var(--border)] mb-2 mt-4">
          <button
            onClick={() => setActiveTab("saved")}
            className={`px-5 py-2.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 cursor-pointer ${
              activeTab === "saved"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Saved Database ({savedBusinesses.length})
          </button>
          <button
            onClick={() => setActiveTab("scouted")}
            className={`px-5 py-2.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 cursor-pointer ${
              activeTab === "scouted"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Scouted Results ({scoutedBusinesses.length})
          </button>
        </div>

        <BusinessGrid
          businesses={activeTab === "saved" ? savedBusinesses : scoutedBusinesses}
          savedBusinesses={savedBusinesses}
          onSaveBusiness={handleSaveBusiness}
          showToast={showToast}
        />
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

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border flex items-center space-x-3 transition-all duration-300 transform translate-y-0 animate-fade-in-up ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300"
                : toast.type === "error"
                ? "bg-rose-950/90 border-rose-500/30 text-rose-300"
                : "bg-indigo-950/90 border-indigo-500/30 text-indigo-300"
            } backdrop-blur-md`}
          >
            <span className="text-sm">
              {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}
            </span>
            <div className="text-xs font-medium flex-1">{toast.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

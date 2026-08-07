"use client";

import React, { useState, useEffect, useRef } from "react";

interface Business {
  place_id: string;
  name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string;
  website: string | null;
  phone_number: string | null;
  rating: number | null;
  review_count: number | null;
  opening_hours: string[] | null;
  primary_image_url: string;
  short_description: string;
  queried_at?: string;
  query?: string;
}

interface AgentLog {
  id: string;
  type: "log" | "thought" | "business_saved" | "error" | "complete";
  message?: string;
  step?: number;
  thought?: string;
  action?: string;
  parameters?: any;
  timestamp: string;
}

interface BackendStatus {
  database: {
    connected_to_mongodb: boolean;
    storage_type: string;
    file_path: string | null;
  };
  config: {
    gemini_api_key_configured: boolean;
    search_provider: string;
    google_places_api_key_configured: boolean;
    serper_api_key_configured: boolean;
  };
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [status, setStatus] = useState<BackendStatus | null>(null);
  
  // Local filtering & sorting state
  const [filterQuery, setFilterQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "rating" | "reviews">("newest");
  
  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    gemini_api_key: "",
    mongodb_uri: "",
    search_provider: "bing",
    google_places_api_key: "",
    serper_api_key: ""
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchStatus();
    fetchBusinesses();
  }, []);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/status");
      const data = await res.json();
      setStatus(data);
      setSettingsForm({
        gemini_api_key: "", // Keep keys blank in form for security
        mongodb_uri: data.database.connected_to_mongodb ? "" : "mongodb://localhost:27017",
        search_provider: data.config.search_provider,
        google_places_api_key: "",
        serper_api_key: ""
      });
    } catch (e) {
      console.error("Error fetching backend status:", e);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/businesses");
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (e) {
      console.error("Error fetching businesses:", e);
    }
  };

  const handleStartAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Reset previous logs and state
    setLogs([]);
    setSearching(true);

    // Close any existing SSE stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `http://localhost:8000/api/search?query=${encodeURIComponent(query)}`
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const stepData = JSON.parse(event.data);
        const timestamp = new Date().toLocaleTimeString();
        const logId = Math.random().toString(36).substring(2);

        if (stepData.type === "business_saved") {
          // Add to logs
          setLogs((prev) => [
            ...prev,
            {
              id: logId,
              type: "business_saved",
              message: stepData.message,
              timestamp
            }
          ]);
          // Live append to businesses grid
          setBusinesses((prev) => {
            // Prevent duplicates in view
            const exists = prev.some((b) => b.place_id === stepData.business.place_id);
            if (exists) return prev;
            return [stepData.business, ...prev];
          });
        } else if (stepData.type === "thought") {
          setLogs((prev) => [
            ...prev,
            {
              id: logId,
              type: "thought",
              step: stepData.step,
              thought: stepData.thought,
              action: stepData.action,
              parameters: stepData.parameters,
              timestamp
            }
          ]);
        } else if (stepData.type === "log") {
          setLogs((prev) => [
            ...prev,
            {
              id: logId,
              type: "log",
              message: stepData.message,
              timestamp
            }
          ]);
        } else if (stepData.type === "error") {
          setLogs((prev) => [
            ...prev,
            {
              id: logId,
              type: "error",
              message: stepData.message,
              timestamp
            }
          ]);
          setSearching(false);
          eventSource.close();
        } else if (stepData.type === "complete") {
          setLogs((prev) => [
            ...prev,
            {
              id: logId,
              type: "complete",
              message: stepData.message,
              timestamp
            }
          ]);
          setSearching(false);
          eventSource.close();
          // Refresh entire lists to keep in sync
          fetchBusinesses();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "error",
          message: "Server Connection Lost. Backend API might be offline.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setSearching(false);
      eventSource.close();
    };
  };

  const handleStopAgent = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          type: "log",
          message: "⏹️ Agent execution manually stopped by user.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setSearching(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: any = {};
      // Only send values that are filled out
      if (settingsForm.gemini_api_key) payload.gemini_api_key = settingsForm.gemini_api_key;
      if (settingsForm.mongodb_uri) payload.mongodb_uri = settingsForm.mongodb_uri;
      if (settingsForm.search_provider) payload.search_provider = settingsForm.search_provider;
      if (settingsForm.google_places_api_key) payload.google_places_api_key = settingsForm.google_places_api_key;
      if (settingsForm.serper_api_key) payload.serper_api_key = settingsForm.serper_api_key;

      const res = await fetch("http://localhost:8000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchStatus();
        setShowSettings(false);
      } else {
        alert("Failed to save settings");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Get unique categories for filter dropdown
  const categories = ["All", ...Array.from(new Set(businesses.map((b) => b.category)))];

  // Process & Sort lists
  const filteredBusinesses = businesses
    .filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        b.address.toLowerCase().includes(filterQuery.toLowerCase()) ||
        b.short_description.toLowerCase().includes(filterQuery.toLowerCase());
      const matchesCategory = filterCategory === "All" || b.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "rating") {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === "reviews") {
        return (b.review_count || 0) - (a.review_count || 0);
      }
      // default: newest
      const dateA = a.queried_at ? new Date(a.queried_at).getTime() : 0;
      const dateB = b.queried_at ? new Date(b.queried_at).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <div className="relative min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col antialiased">
      {/* Decorative blurred backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/15 rounded-full filter blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/10 rounded-full filter blur-[120px] animate-pulse-slow pointer-events-none" />

      {/* Main Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-8.22-.07m0 0a8.3 8.3 0 0 0-2.28-2.28m7.22 7.22v3.75m0-3.75a1.5 1.5 0 0 1-3 0M3.75 3v1.5m0 0v3.75m0-3.75h3.75M20.25 3v1.5m0 0v3.75m0-3.75h-3.75M3 20.25v-1.5m0 0v-3.75m0 3.75h3.75m13.5 0v-1.5m0 0v-3.75m0 3.75h-3.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center">
              AURA <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded ml-2 border border-purple-500/30">Scout Agent</span>
            </h1>
            <p className="text-xs text-zinc-400">Autonomous business extraction agent</p>
          </div>
        </div>

        {/* Status Indicators & Settings toggle */}
        <div className="flex items-center space-x-4">
          {status && (
            <div className="hidden md:flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span className="text-zinc-500">Database:</span>
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${status.database.connected_to_mongodb ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {status.database.connected_to_mongodb ? "MongoDB (Active)" : "JSON Fallback"}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span className="text-zinc-500">Gemini:</span>
                <span className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${status.config.gemini_api_key_configured ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {status.config.gemini_api_key_configured ? "Connected" : "Key Missing"}
                </span>
              </div>

              <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span className="text-zinc-500">Search:</span>
                <span className="text-purple-300 font-semibold uppercase">{status.config.search_provider}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition duration-200 border border-zinc-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.936 6.936 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left Column: Control Panel & Live Agent Terminal (4 cols) */}
        <section className="lg:col-span-5 flex flex-col space-y-6 max-h-[calc(100vh-130px)]">
          
          {/* Search Trigger Panel */}
          <div className="glass-panel p-5 rounded-2xl glow-purple border-purple-500/20">
            <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3">Scout Workspace</h2>
            <form onSubmit={handleStartAgent} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Enter Business Query</label>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. cafes in Delhi, bookstores near Connaught Place"
                    disabled={searching}
                    className="w-full bg-zinc-950 text-white placeholder-zinc-500 px-4 py-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
                  />
                  {query && !searching && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                {!searching ? (
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-8.22-.07m0 0a8.3 8.3 0 0 0-2.28-2.28m7.22 7.22v3.75m0-3.75a1.5 1.5 0 0 1-3 0M3.75 3v1.5m0 0v3.75m0-3.75h3.75M20.25 3v1.5m0 0v3.75m0-3.75h-3.75M3 20.25v-1.5m0 0v-3.75m0 3.75h3.75m13.5 0v-1.5m0 0v-3.75m0 3.75h-3.75" />
                    </svg>
                    <span>Launch AI Scout</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopAgent}
                    className="flex-1 bg-rose-600/90 hover:bg-rose-600 text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                    <span>Stop Agent</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Live Agent Console (terminal view) */}
          <div className="flex-1 glass-panel rounded-2xl border-zinc-800/80 overflow-hidden flex flex-col scanline relative">
            {/* Terminal Header */}
            <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-900 flex items-center justify-between text-xs text-zinc-500 font-mono">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 font-semibold">agent_console.log</span>
              </div>
              <div>{searching ? "STATUS: ACTIVE" : "STATUS: IDLE"}</div>
            </div>

            {/* Terminal Logs Output */}
            <div className="flex-1 bg-zinc-950/80 p-4 overflow-y-auto font-mono text-xs space-y-4">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center p-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-2 opacity-40 text-purple-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                  </svg>
                  <p>Awaiting Scout query parameters...</p>
                  <p className="text-[10px] mt-1 text-zinc-700">Logs and thoughts will stream here live</p>
                </div>
              ) : (
                logs.map((log) => {
                  if (log.type === "thought") {
                    return (
                      <div key={log.id} className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-purple-400 font-semibold border-b border-purple-500/10 pb-1 text-[10px]">
                          <span className="flex items-center">
                            <span className="mr-1">🧠</span> AGENT THOUGHT (Step {log.step})
                          </span>
                          <span>{log.timestamp}</span>
                        </div>
                        <p className="text-purple-100/90 leading-relaxed text-[11px] font-sans italic">
                          "{log.thought}"
                        </p>
                        <div className="text-[10px] text-indigo-300 font-mono mt-1 pt-1 border-t border-purple-500/5">
                          <span className="text-zinc-500">Next Action:</span> {log.action}({JSON.stringify(log.parameters)})
                        </div>
                      </div>
                    );
                  }

                  if (log.type === "business_saved") {
                    return (
                      <div key={log.id} className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 text-[11px] text-emerald-200">
                        <div className="font-semibold text-emerald-400 flex items-center mb-1">
                          <span className="mr-1">🎉</span> DATABASE STORAGE TRIGGERED
                        </div>
                        {log.message}
                      </div>
                    );
                  }

                  if (log.type === "error") {
                    return (
                      <div key={log.id} className="text-rose-400 bg-rose-950/20 border border-rose-500/20 rounded-lg p-2.5">
                        <span className="font-semibold">❌ ERROR:</span> {log.message}
                      </div>
                    );
                  }

                  if (log.type === "complete") {
                    return (
                      <div key={log.id} className="text-purple-300 bg-purple-600/10 border border-purple-500/30 rounded-lg p-3 text-center font-semibold">
                        🏆 {log.message}
                      </div>
                    );
                  }

                  // Default status log
                  return (
                    <div key={log.id} className="text-zinc-400 flex items-start space-x-2 text-[11px]">
                      <span className="text-zinc-600">[{log.timestamp}]</span>
                      <span className="flex-1 leading-normal">{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </section>

        {/* Right Column: Stored Businesses Grid & Filter (7 cols) */}
        <section className="lg:col-span-7 flex flex-col space-y-4 max-h-[calc(100vh-130px)]">
          
          {/* Filters card */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-300 mb-1">Database Records ({filteredBusinesses.length})</h2>
              <p className="text-xs text-zinc-500">Explore businesses stored in the search database</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Sort filter */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="newest">Newest Scraped</option>
                <option value="rating">Highest Rating</option>
                <option value="reviews">Most Reviews</option>
              </select>

              {/* Text search within grid */}
              <div className="relative">
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter records..."
                  className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl pl-8 pr-3 py-2 text-zinc-300 focus:outline-none focus:border-purple-500 w-36 md:w-44"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.608 10.608Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Grid list container */}
          <div className="flex-1 overflow-y-auto pr-1">
            {filteredBusinesses.length === 0 ? (
              <div className="h-64 glass-panel rounded-2xl flex flex-col items-center justify-center text-zinc-500 text-center p-6 border-dashed border-zinc-800">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-3 text-zinc-600 opacity-60">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <h3 className="text-sm font-semibold text-zinc-300 mb-1">No Business Records Found</h3>
                <p className="text-xs text-zinc-500">Run a scout query using the agent console to populate records, or adjust filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                {filteredBusinesses.map((biz) => (
                  <div key={biz.place_id} className="glass-card rounded-2xl overflow-hidden flex flex-col h-full border border-zinc-800/40 relative">
                    
                    {/* Header Image */}
                    <div className="h-36 relative bg-zinc-900 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={biz.primary_image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500"}
                        alt={biz.name}
                        className="w-full h-full object-cover transition duration-300 hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500";
                        }}
                      />
                      
                      {/* Category Badge */}
                      <span className="absolute top-3 left-3 bg-zinc-950/85 backdrop-blur border border-zinc-800 text-[10px] font-medium text-purple-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {biz.category}
                      </span>

                      {/* Source database indicator */}
                      <span className="absolute top-3 right-3 bg-zinc-950/85 backdrop-blur border border-zinc-800 text-[9px] text-zinc-400 px-2 py-0.5 rounded">
                        {biz.place_id.startsWith("ddg_") || biz.place_id.startsWith("bing_") ? "FREE SCRAPE" : "API RESULT"}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <h3 className="font-bold text-white text-sm line-clamp-1 hover:text-purple-300 transition">
                          {biz.name}
                        </h3>

                        {/* Rating reviews line */}
                        {biz.rating !== null && (
                          <div className="flex items-center space-x-1.5 text-xs">
                            <span className="text-amber-400">★</span>
                            <span className="text-zinc-200 font-semibold">{biz.rating.toFixed(1)}</span>
                            <span className="text-zinc-500">({biz.review_count} reviews)</span>
                          </div>
                        )}

                        <p className="text-xs text-zinc-400 flex items-start space-x-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 mt-0.5 text-purple-500 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          <span className="line-clamp-1">{biz.address}</span>
                        </p>

                        <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed italic">
                          "{biz.short_description || 'No description retrieved.'}"
                        </p>
                      </div>

                      {/* Contact and Maps Buttons */}
                      <div className="pt-2 border-t border-zinc-800/40 flex flex-col space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">Phone:</span>
                          <span className="text-zinc-300 font-medium">{biz.phone_number || "Not Available"}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">Website:</span>
                          {biz.website ? (
                            <a
                              href={biz.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-400 hover:underline truncate max-w-[150px]"
                            >
                              Visit Site
                            </a>
                          ) : (
                            <span className="text-zinc-600">Not Available</span>
                          )}
                        </div>

                        {/* Maps URL button */}
                        <a
                          href={biz.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-center py-1.5 rounded-lg text-zinc-300 hover:text-white transition duration-200 flex items-center justify-center space-x-1.5 text-[11px]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.446 1.202-.721a1.125 1.125 0 0 0 .502-.952V4.676a1.125 1.125 0 0 0-.502-.952l-3.003-1.802a1.124 1.124 0 0 0-1.006 0L10.203 4.71a1.125 1.125 0 0 1-1.006 0L6.195 2.908a1.125 1.125 0 0 0-1.006 0L3.986 3.63a1.125 1.125 0 0 0-.502.952V18.17c0 .416.223.799.582.996l3.004 1.654a1.125 1.125 0 0 0 1.006 0l3.003-1.654a1.125 1.125 0 0 1 1.006 0l3.003 1.654a1.125 1.125 0 0 0 1.006 0Z" />
                          </svg>
                          <span>Open in Google Maps</span>
                        </a>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Settings Modal Dialog */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Agent Settings</h3>
                <p className="text-xs text-zinc-500">Configure search provider and credentials</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-zinc-500 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs text-zinc-300">
              
              {/* Gemini API Key */}
              <div className="space-y-1">
                <label className="block text-zinc-400 font-semibold">Gemini API Key</label>
                <input
                  type="password"
                  value={settingsForm.gemini_api_key}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gemini_api_key: e.target.value })}
                  placeholder="Paste GEMINI_API_KEY (leave blank to keep current)"
                  className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* MongoDB URI */}
              <div className="space-y-1">
                <label className="block text-zinc-400 font-semibold">MongoDB URI</label>
                <input
                  type="text"
                  value={settingsForm.mongodb_uri}
                  onChange={(e) => setSettingsForm({ ...settingsForm, mongodb_uri: e.target.value })}
                  placeholder="mongodb://localhost:27017 (leave blank to keep current)"
                  className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Search Provider */}
              <div className="space-y-1">
                <label className="block text-zinc-400 font-semibold">Default Search Provider</label>
                <select
                  value={settingsForm.search_provider}
                  onChange={(e) => setSettingsForm({ ...settingsForm, search_provider: e.target.value })}
                  className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="bing">Bing Search Scraper (Free, Default)</option>
                  <option value="google">Google Places API (Key required)</option>
                  <option value="serper">Serper Maps API (Key required)</option>
                </select>
              </div>

              {/* Google Places Key */}
              {settingsForm.search_provider === "google" && (
                <div className="space-y-1">
                  <label className="block text-zinc-400 font-semibold">Google Places API Key</label>
                  <input
                    type="password"
                    value={settingsForm.google_places_api_key}
                    onChange={(e) => setSettingsForm({ ...settingsForm, google_places_api_key: e.target.value })}
                    placeholder="Paste GOOGLE_PLACES_API_KEY"
                    className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Serper Maps Key */}
              {settingsForm.search_provider === "serper" && (
                <div className="space-y-1">
                  <label className="block text-zinc-400 font-semibold">Serper API Key</label>
                  <input
                    type="password"
                    value={settingsForm.serper_api_key}
                    onChange={(e) => setSettingsForm({ ...settingsForm, serper_api_key: e.target.value })}
                    placeholder="Paste SERPER_API_KEY"
                    className="w-full bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-zinc-800 flex space-x-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg hover:text-white transition duration-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition duration-200 cursor-pointer disabled:opacity-50"
                >
                  {savingSettings ? "Saving..." : "Save Settings"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Footer status bar for mobile screens */}
      <footer className="md:hidden glass-panel border-t border-zinc-850 py-2.5 px-4 text-[10px] text-zinc-500 flex items-center justify-between mt-auto">
        <span>Aura Business Scout 1.0</span>
        {status && (
          <span className="flex items-center">
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.database.connected_to_mongodb ? "bg-emerald-500" : "bg-amber-500"}`} />
            {status.database.connected_to_mongodb ? "MongoDB Online" : "JSON Fallback"}
          </span>
        )}
      </footer>
    </div>
  );
}

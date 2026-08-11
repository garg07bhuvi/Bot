"use client";

import { useState } from "react";
import type { Business } from "@/lib/types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500";

function isScraped(placeId: string) {
  return placeId.startsWith("ddg_") || placeId.startsWith("bing_") || placeId.startsWith("osm_");
}

export function BusinessCard({
  business,
  isSaved,
  onSave,
  showToast,
}: {
  business: Business;
  isSaved: boolean;
  onSave?: (business: Business) => void;
  showToast: (message: string, type?: "success" | "info" | "error") => void;
}) {
  const [imageSrc, setImageSrc] = useState(
    business.primary_image_url || FALLBACK_IMAGE
  );
  const [isTriggering, setIsTriggering] = useState(false);
  const [isRedesignModalOpen, setIsRedesignModalOpen] = useState(false);
  const [status, setStatus] = useState<string | undefined>(business.redesign_status);
  const [modalBusiness, setModalBusiness] = useState<Business>(business);

  const handleRedesignTrigger = async () => {
    setIsTriggering(true);
    setStatus("in_progress");
    try {
      const res = await fetch("/api/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: business.place_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger redesign");
      
      setStatus("pending");
      showToast("Website crawled & screenshots captured! Processing Stitch redesign...", "info");
    } catch (err) {
      console.error(err);
      showToast(`Redesign failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      setStatus("failed");
    } finally {
      setIsTriggering(false);
    }
  };

  const openRedesignModal = async () => {
    setIsRedesignModalOpen(true);
    try {
      const res = await fetch("/api/businesses");
      const data = await res.json();
      const list = data.businesses || data; // handle both array and wrapper formats
      const updated = Array.isArray(list) ? list.find((b: Business) => b.place_id === business.place_id) : null;
      if (updated) {
        setModalBusiness(updated);
      }
    } catch (err) {
      console.error("Failed to load updated redesign status:", err);
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col h-full relative">
      <div className="h-36 relative bg-[var(--secondary)] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={business.name}
          className="w-full h-full object-cover transition duration-300 hover:scale-105"
          onError={() => setImageSrc(FALLBACK_IMAGE)}
        />

        <span className="absolute top-3 left-3 bg-[var(--card)]/90 border border-[var(--border)] text-[10px] font-medium text-[var(--primary)] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          {business.category}
        </span>

        <span className="absolute top-3 right-3 bg-[var(--card)]/90 border border-[var(--border)] text-[9px] text-[var(--muted-foreground)] px-2 py-0.5 rounded">
          {isScraped(business.place_id) ? "FREE SCRAPE" : "API RESULT"}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <h3 className="font-semibold text-[var(--foreground)] text-sm line-clamp-1 hover:text-[var(--primary)] transition">
            {business.name}
          </h3>

          {business.rating !== null && (
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-amber-600">★</span>
              <span className="text-[var(--foreground)] font-semibold">
                {business.rating.toFixed(1)}
              </span>
              <span className="text-[var(--muted-foreground)]">
                ({business.review_count} reviews)
              </span>
            </div>
          )}

          <p className="text-xs text-[var(--muted-foreground)] flex items-start space-x-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-3.5 h-3.5 mt-0.5 text-[var(--primary)] shrink-0"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
            <span className="line-clamp-1">{business.address}</span>
          </p>

          <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 leading-relaxed italic">
            &quot;{business.short_description || "No description retrieved."}
            &quot;
          </p>
        </div>

        <div className="pt-2 border-t border-[var(--border)] flex flex-col space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--muted-foreground)]">Phone:</span>
            <span className="text-[var(--foreground)] font-medium">
              {business.phone_number || "Not Available"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--muted-foreground)]">Website:</span>
            {business.website ? (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline truncate max-w-[150px]"
              >
                Visit Site
              </a>
            ) : (
              <span className="text-[var(--muted-foreground)]/60">Not Available</span>
            )}
          </div>

          <a
            href={business.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 w-full bg-[var(--secondary)] hover:bg-[var(--border)] border border-[var(--border)] text-center py-1.5 rounded-lg text-[var(--foreground)] transition duration-200 flex items-center justify-center space-x-1.5 text-[11px]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-3.5 h-3.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.446 1.202-.721a1.125 1.125 0 0 0 .502-.952V4.676a1.125 1.125 0 0 0-.502-.952l-3.003-1.802a1.124 1.124 0 0 0-1.006 0L10.203 4.71a1.125 1.125 0 0 1-1.006 0L6.195 2.908a1.125 1.125 0 0 0-1.006 0L3.986 3.63a1.125 1.125 0 0 0-.502.952V18.17c0 .416.223.799.582.996l3.004 1.654a1.125 1.125 0 0 0 1.006 0l3.003-1.654a1.125 1.125 0 0 1 1.006 0l3.003 1.654a1.125 1.125 0 0 0 1.006 0Z"
              />
            </svg>
            <span>Open in Google Maps</span>
          </a>

          {!isSaved ? (
            <button
              onClick={() => onSave?.(business)}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-medium py-1.5 rounded-lg transition duration-200 flex items-center justify-center space-x-1.5 text-[11px] shadow-sm cursor-pointer"
            >
              <span>➕ Save to Database</span>
            </button>
          ) : (
            <>
              {business.website && (
                <div className="pt-1 space-y-1.5">
                  {status && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--muted-foreground)] font-medium">Redesign Status:</span>
                      <span className={`font-semibold uppercase tracking-wider ${
                        status === "in_progress" 
                          ? "text-amber-500 animate-pulse font-semibold"
                          : status === "pending"
                          ? "text-indigo-400 font-semibold"
                          : status === "done"
                          ? "text-emerald-500 font-semibold"
                          : "text-rose-500 font-semibold"
                      }`}>
                        {status.replace("_", " ")}
                      </span>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    {status === "in_progress" ? (
                      <button
                        disabled
                        className="w-full bg-[var(--secondary)] opacity-70 border border-[var(--border)] py-1.5 rounded-lg text-[11px] font-medium text-[var(--foreground)] flex items-center justify-center space-x-1.5"
                      >
                        <span className="animate-spin text-[var(--primary)] shrink-0">⏳</span>
                        <span>Crawling Site...</span>
                      </button>
                    ) : status === "done" ? (
                      <>
                        <button
                          onClick={openRedesignModal}
                          className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 py-1.5 rounded-lg text-[11px] font-medium text-emerald-500 flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          🎨 View Redesign
                        </button>
                        <button
                          onClick={handleRedesignTrigger}
                          disabled={isTriggering}
                          className="px-2.5 bg-[var(--secondary)] hover:bg-[var(--border)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--muted-foreground)] flex items-center justify-center cursor-pointer"
                          title="Re-run Crawler"
                        >
                          🔄
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleRedesignTrigger}
                        disabled={isTriggering}
                        className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 py-1.5 rounded-lg text-[11px] font-medium text-indigo-500 flex items-center justify-center space-x-1 disabled:opacity-50 cursor-pointer"
                      >
                        <span>{isTriggering ? "⏳ Crawling..." : "🚀 Redesign Website"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isRedesignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setIsRedesignModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg"
            >
              ✕
            </button>
            
            <div className="space-y-1">
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Stitch Redesign Preview
              </span>
              <h2 className="text-xl font-bold text-[var(--foreground)]">{modalBusiness.name}</h2>
              <p className="text-xs text-[var(--muted-foreground)]">{modalBusiness.category} • {modalBusiness.address}</p>
            </div>

            <div className="border-t border-[var(--border)] pt-4 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">AI Redesign Prompt</h4>
                <p className="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] border border-[var(--border)] p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                  {modalBusiness.redesign_prompt || "No prompt recorded."}
                </p>
              </div>

              {modalBusiness.redesign_image_urls && modalBusiness.redesign_image_urls.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider animate-pulse">Preview Screens</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {modalBusiness.redesign_image_urls.map((url, idx) => (
                      <div key={idx} className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--secondary)] relative">
                        <span className="absolute top-2 left-2 bg-black/70 text-[9px] font-medium text-white px-2 py-0.5 rounded">
                          {idx === 0 ? "Desktop Screen" : idx === 1 ? "Mobile Screen" : `Screen ${idx + 1}`}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Redesign screen ${idx + 1}`}
                          className="w-full h-auto object-cover max-h-[300px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  🛠️ Design screens are being generated by the agent. Check back in a few seconds!
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center text-xs">
              <span className="text-[var(--muted-foreground)]">
                Redesigned on: {modalBusiness.redesigned_at ? new Date(modalBusiness.redesigned_at).toLocaleString() : "N/A"}
              </span>
              {modalBusiness.stitch_project_id && (
                <span className="text-[var(--muted-foreground)] font-mono text-[10px]">
                  Project ID: {modalBusiness.stitch_project_id}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Business } from "@/lib/types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500";

function isScraped(placeId: string) {
  return placeId.startsWith("ddg_") || placeId.startsWith("bing_");
}

export function BusinessCard({ business }: { business: Business }) {
  const [imageSrc, setImageSrc] = useState(
    business.primary_image_url || FALLBACK_IMAGE
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full border border-zinc-800/40 relative">
      <div className="h-36 relative bg-zinc-900 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={business.name}
          className="w-full h-full object-cover transition duration-300 hover:scale-105"
          onError={() => setImageSrc(FALLBACK_IMAGE)}
        />

        <span className="absolute top-3 left-3 bg-zinc-950/85 backdrop-blur border border-zinc-800 text-[10px] font-medium text-purple-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          {business.category}
        </span>

        <span className="absolute top-3 right-3 bg-zinc-950/85 backdrop-blur border border-zinc-800 text-[9px] text-zinc-400 px-2 py-0.5 rounded">
          {isScraped(business.place_id) ? "FREE SCRAPE" : "API RESULT"}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <h3 className="font-bold text-white text-sm line-clamp-1 hover:text-purple-300 transition">
            {business.name}
          </h3>

          {business.rating !== null && (
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-amber-400">★</span>
              <span className="text-zinc-200 font-semibold">
                {business.rating.toFixed(1)}
              </span>
              <span className="text-zinc-500">
                ({business.review_count} reviews)
              </span>
            </div>
          )}

          <p className="text-xs text-zinc-400 flex items-start space-x-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-3.5 h-3.5 mt-0.5 text-purple-500 shrink-0"
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

          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed italic">
            &quot;{business.short_description || "No description retrieved."}
            &quot;
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-800/40 flex flex-col space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Phone:</span>
            <span className="text-zinc-300 font-medium">
              {business.phone_number || "Not Available"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Website:</span>
            {business.website ? (
              <a
                href={business.website}
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

          <a
            href={business.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-center py-1.5 rounded-lg text-zinc-300 hover:text-white transition duration-200 flex items-center justify-center space-x-1.5 text-[11px]"
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
        </div>
      </div>
    </div>
  );
}

"use client";

import type { FormEvent } from "react";

export function ScoutForm({
  query,
  onQueryChange,
  searching,
  onStart,
  onStop,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searching: boolean;
  onStart: (e: FormEvent) => void;
  onStop: () => void;
}) {
  return (
    <div className="glass-panel p-5 rounded-2xl glow-purple border-purple-500/20">
      <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3">
        Scout Workspace
      </h2>
      <form onSubmit={onStart} className="space-y-3">
        <div>
          <label
            htmlFor="scout-query"
            className="block text-xs text-zinc-400 mb-1"
          >
            Enter Business Query
          </label>
          <div className="relative">
            <input
              id="scout-query"
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. cafes in Delhi, bookstores near Connaught Place"
              disabled={searching}
              className="w-full bg-zinc-950 text-white placeholder-zinc-500 px-4 py-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
            />
            {query && !searching && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear query"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.59 14.37a6 6 0 0 1-8.22-.07m0 0a8.3 8.3 0 0 0-2.28-2.28m7.22 7.22v3.75m0-3.75a1.5 1.5 0 0 1-3 0M3.75 3v1.5m0 0v3.75m0-3.75h3.75M20.25 3v1.5m0 0v3.75m0-3.75h-3.75M3 20.25v-1.5m0 0v-3.75m0 3.75h3.75m13.5 0v-1.5m0 0v-3.75m0 3.75h-3.75"
                />
              </svg>
              <span>Launch AI Scout</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStop}
              className="flex-1 bg-rose-600/90 hover:bg-rose-600 text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
              <span>Stop Agent</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

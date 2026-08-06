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
    <form onSubmit={onStart} className="glass-panel rounded-xl p-2 flex flex-col sm:flex-row gap-2">
      <label htmlFor="scout-query" className="sr-only">
        Business query
      </label>
      <div className="relative flex-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.608 10.608Z"
          />
        </svg>
        <input
          id="scout-query"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search a business type and place — e.g. cafes in Delhi"
          disabled={searching}
          className="w-full bg-transparent text-[var(--foreground)] placeholder-[var(--muted-foreground)] pl-10 pr-9 py-3 rounded-lg focus:outline-none disabled:opacity-50 text-[15px]"
        />
        {query && !searching && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear query"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {!searching ? (
        <button
          type="submit"
          className="bg-[var(--primary)] hover:bg-[#a84e35] text-white font-medium px-6 py-3 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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
          Launch Scout
        </button>
      ) : (
        <button
          type="button"
          onClick={onStop}
          className="bg-[var(--destructive)] hover:bg-[#8f3323] text-white font-medium px-6 py-3 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Stop Agent
        </button>
      )}
    </form>
  );
}

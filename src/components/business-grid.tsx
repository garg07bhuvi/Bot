"use client";

import { useMemo, useState } from "react";
import { BusinessCard } from "@/components/business-card";
import type { Business, SortBy } from "@/lib/types";

function sortBusinesses(a: Business, b: Business, sortBy: SortBy) {
  if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
  if (sortBy === "reviews") return (b.review_count ?? 0) - (a.review_count ?? 0);
  const dateA = a.queried_at ? new Date(a.queried_at).getTime() : 0;
  const dateB = b.queried_at ? new Date(b.queried_at).getTime() : 0;
  return dateB - dateA;
}

/**
 * Filter and sort state lives here rather than in the dashboard, so typing in
 * the filter box doesn't re-render the agent console or the SSE-driven state.
 */
export function BusinessGrid({ businesses }: { businesses: Business[] }) {
  const [filterQuery, setFilterQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(businesses.map((b) => b.category)))],
    [businesses]
  );

  const filteredBusinesses = useMemo(() => {
    const needle = filterQuery.toLowerCase();
    return businesses
      .filter((b) => {
        const matchesSearch =
          b.name.toLowerCase().includes(needle) ||
          b.address.toLowerCase().includes(needle) ||
          b.short_description.toLowerCase().includes(needle);
        const matchesCategory =
          filterCategory === "All" || b.category === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => sortBusinesses(a, b, sortBy));
  }, [businesses, filterQuery, filterCategory, sortBy]);

  return (
    <section className="lg:col-span-7 flex flex-col space-y-4 max-h-[calc(100vh-130px)]">
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-zinc-300 mb-1">
            Database Records ({filteredBusinesses.length})
          </h2>
          <p className="text-xs text-zinc-500">
            Explore businesses stored in the search database
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
            className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            aria-label="Sort records"
            className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="newest">Newest Scraped</option>
            <option value="rating">Highest Rating</option>
            <option value="reviews">Most Reviews</option>
          </select>

          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter records..."
              aria-label="Filter records by text"
              className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl pl-8 pr-3 py-2 text-zinc-300 focus:outline-none focus:border-purple-500 w-36 md:w-44"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.608 10.608Z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {filteredBusinesses.length === 0 ? (
          <div className="h-64 glass-panel rounded-2xl flex flex-col items-center justify-center text-zinc-500 text-center p-6 border-dashed border-zinc-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 mb-3 text-zinc-600 opacity-60"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">
              No Business Records Found
            </h3>
            <p className="text-xs text-zinc-500">
              Run a scout query using the agent console to populate records, or
              adjust filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
            {filteredBusinesses.map((biz) => (
              <BusinessCard key={biz.place_id} business={biz} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { createRequire } from "module";
import type ApiType from "botasaurus-desktop-api";
import type { Business } from "@/lib/types";

// Turbopack's static import of this dual CJS/ESM package resolves inconsistently
// across route bundles; loading it via Node's own CJS resolver sidesteps that.
const Api = createRequire(import.meta.url)("botasaurus-desktop-api").default as typeof ApiType;

/**
 * The desktop app assigns its scraper name and request field names per install
 * (shown on its local API-docs page after setup) — override via env once known.
 */
const SCRAPER_NAME = process.env.MAPS_SCRAPER_NAME ?? "google-maps-extractor";
const QUERY_FIELD = process.env.MAPS_SCRAPER_QUERY_FIELD ?? "queries";

function field(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined) return raw[key];
  }
  return undefined;
}

function toCoord(raw: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
  const coords = field(raw, "COORDINATES", "coordinates", "coords");
  if (Array.isArray(coords) && coords.length === 2) {
    return { latitude: Number(coords[0]), longitude: Number(coords[1]) };
  }
  if (coords && typeof coords === "object") {
    const c = coords as Record<string, unknown>;
    return {
      latitude: Number(field(c, "lat", "latitude") ?? null) || null,
      longitude: Number(field(c, "lng", "lon", "longitude") ?? null) || null,
    };
  }
  return { latitude: null, longitude: null };
}

function toHours(raw: Record<string, unknown>): string[] | null {
  const hours = field(raw, "HOURS", "hours", "WORKDAY_TIMING", "workday_timing");
  if (Array.isArray(hours)) return hours.map(String);
  if (hours && typeof hours === "object") return Object.values(hours as object).map(String);
  return null;
}

function toBusiness(raw: Record<string, unknown>, query: string): Business {
  const { latitude, longitude } = toCoord(raw);
  return {
    place_id: String(field(raw, "PLACE_ID", "place_id") ?? crypto.randomUUID()),
    name: String(field(raw, "NAME", "name") ?? ""),
    category: String(field(raw, "MAIN_CATEGORY", "main_category", "category") ?? ""),
    address: String(field(raw, "ADDRESS", "address") ?? ""),
    latitude,
    longitude,
    google_maps_url: String(field(raw, "LINK", "link", "google_maps_url") ?? ""),
    website: (field(raw, "WEBSITE", "website") as string) || null,
    phone_number: (field(raw, "PHONE", "phone") as string) || null,
    rating: field(raw, "RATING", "rating") != null ? Number(field(raw, "RATING", "rating")) : null,
    review_count: field(raw, "REVIEWS", "reviews") != null ? Number(field(raw, "REVIEWS", "reviews")) : null,
    opening_hours: toHours(raw),
    primary_image_url: String(field(raw, "FEATURED_IMAGE", "featured_image") ?? ""),
    short_description: String(field(raw, "DESCRIPTION", "description", "ABOUT", "about") ?? ""),
    queried_at: new Date().toISOString(),
    query,
  };
}

/** Runs the Google Maps Extractor desktop app's scraper synchronously and returns mapped businesses. */
export async function scrapeBusinesses(query: string): Promise<Business[]> {
  const api = new Api({ apiUrl: process.env.MAPS_EXTRACTOR_API_URL });

  const running = await api.isApiRunning();
  if (!running) {
    throw new Error(
      "Google Maps Extractor desktop app isn't reachable. Install and launch it, then set MAPS_EXTRACTOR_API_URL if it's not on the default port."
    );
  }

  const task = await api.createSyncTask({
    scraperName: SCRAPER_NAME,
    data: { [QUERY_FIELD]: [query] },
  });

  const results: Record<string, unknown>[] = Array.isArray(task.result) ? task.result : [];
  return results.map((r) => toBusiness(r, query));
}

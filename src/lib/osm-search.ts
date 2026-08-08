import type { Business } from "@/lib/types";

const USER_AGENT = "AuraBusinessScout/1.0 (local self-hosted instance)";
const SEARCH_RADIUS_METERS = 5000;
const MAX_RESULTS = 20;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Nominatim ranks by global "importance", which can put a fuzzy-matched village
 * ahead of an exact-name match elsewhere (e.g. "Solan" -> a French hamlet outranks
 * Solan, India). Preferring an exact name match among the top candidates fixes that.
 */
async function geocodeLocation(location: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim geocoding failed: ${res.status}`);
  const results: { lat: string; lon: string; display_name: string }[] = await res.json();
  if (!results.length) throw new Error(`Couldn't find a location matching "${location}"`);

  const needle = location.trim().toLowerCase();
  const exact = results.find((r) => r.display_name.split(",")[0].trim().toLowerCase() === needle);
  const best = exact ?? results[0];
  return { lat: Number(best.lat), lon: Number(best.lon) };
}

// The public Overpass API is frequently overloaded; a couple of independently
// run mirrors serve the same data, so falling through to the next on failure
// or timeout is far more reliable than depending on a single instance.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const MIRROR_TIMEOUT_MS = 12_000;

async function queryOverpass(lat: number, lon: number, osmKey: string, osmValue: string): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:25];
nwr["${osmKey}"="${osmValue}"](around:${SEARCH_RADIUS_METERS},${lat},${lon});
out center tags;`;

  let lastError: unknown;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "text/plain" },
        body: query,
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${mirror} responded ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) throw new Error(`${mirror} returned non-JSON (likely overloaded)`);
      const data = await res.json();
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `All Overpass mirrors failed (last error: ${lastError instanceof Error ? lastError.message : lastError}). The free OSM tier is overloaded right now — try again shortly.`
  );
}

function toBusiness(el: OverpassElement, osmKey: string, osmValue: string, query: string): Business | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;
  if (!name || lat === null || lon === null) return null;

  const addressParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);

  return {
    place_id: `osm_${el.type}_${el.id}`,
    name,
    category: tags[osmKey] ?? osmValue,
    address: addressParts.length ? addressParts.join(", ") : "Address not available",
    latitude: lat,
    longitude: lon,
    google_maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    website: tags.website ?? tags["contact:website"] ?? null,
    phone_number: tags.phone ?? tags["contact:phone"] ?? null,
    rating: null,
    review_count: null,
    opening_hours: tags.opening_hours ? tags.opening_hours.split(";").map((s) => s.trim()) : null,
    primary_image_url: "",
    short_description: tags.description ?? "",
    queried_at: new Date().toISOString(),
    query,
  };
}

/** Free, no-signup business lookup via OpenStreetMap (Nominatim geocoding + Overpass POI search). */
export async function searchOsmBusinesses(
  query: string,
  location: string,
  osmKey: string,
  osmValue: string
): Promise<Business[]> {
  const { lat, lon } = await geocodeLocation(location);
  const elements = await queryOverpass(lat, lon, osmKey, osmValue);
  const businesses = elements
    .map((el) => toBusiness(el, osmKey, osmValue, query))
    .filter((b): b is Business => b !== null);
  return businesses.slice(0, MAX_RESULTS);
}

import type { Business } from "@/lib/types";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.currentOpeningHours.openNow",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.editorialSummary",
].join(",");

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  editorialSummary?: { text: string };
}

/**
 * Official Google Places API (New) — searchText. This project's key only has the
 * "new" Places API enabled (the legacy /place/textsearch endpoint returns
 * REQUEST_DENIED for it), so this uses the v1 endpoint + field mask, not the classic one.
 */
export async function searchGooglePlaces(query: string, apiKey: string): Promise<Business[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Google Places error: ${res.status}${body?.error?.message ? ` — ${body.error.message}` : ""}`);
  }

  const data = await res.json();
  const places: PlaceResult[] = data.places ?? [];

  return places
    .filter((p) => p.displayName?.text && p.location)
    .map((p) => ({
      place_id: p.id,
      name: p.displayName!.text,
      category: p.types?.[0]?.replace(/_/g, " ") ?? "business",
      address: p.formattedAddress ?? "Address not available",
      latitude: p.location!.latitude,
      longitude: p.location!.longitude,
      google_maps_url: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
      website: p.websiteUri ?? null,
      phone_number: p.nationalPhoneNumber ?? null,
      rating: p.rating ?? null,
      review_count: p.userRatingCount ?? null,
      opening_hours:
        p.currentOpeningHours?.openNow !== undefined
          ? [p.currentOpeningHours.openNow ? "Open now" : "Closed now"]
          : null,
      primary_image_url: "",
      short_description: p.editorialSummary?.text ?? "",
      queried_at: new Date().toISOString(),
      query,
    }));
}

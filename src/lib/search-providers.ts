import { scrapeBusinesses } from "@/lib/maps-scraper";
import { searchOsmBusinesses } from "@/lib/osm-search";
import { searchGooglePlaces } from "@/lib/google-places";
import type { SearchPlan } from "@/lib/openrouter";
import type { Business, SettingsForm } from "@/lib/types";

export type SearchProviderFn = (
  query: string,
  plan: SearchPlan,
  settings: SettingsForm
) => Promise<Business[]>;

/**
 * Every wired-up business data source, keyed by SettingsForm.search_provider.
 * To add or swap a provider: write a `search*.ts` module returning Business[],
 * then add one line here — nothing in the search route needs to change.
 */
export const SEARCH_PROVIDERS: Record<string, SearchProviderFn> = {
  google: (query, _plan, settings) => {
    if (!settings.google_places_api_key) {
      throw new Error("Google Places API key isn't configured. Add it in Settings.");
    }
    return searchGooglePlaces(query, settings.google_places_api_key);
  },
  osm: (query, plan) => searchOsmBusinesses(query, plan.location, plan.osmKey, plan.osmValue),
  maps_scraper: (query) => scrapeBusinesses(query),
};

export const DEFAULT_SEARCH_PROVIDER = "google";

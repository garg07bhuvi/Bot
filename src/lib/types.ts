export interface Business {
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

  // Step 2 — redesign pipeline (see WEBSITE_REDESIGN_PLAN.md)
  redesign_status?: "pending" | "in_progress" | "done" | "failed";
  redesign_prompt?: string;
  redesign_image_urls?: string[];
  stitch_project_id?: string;
  redesigned_at?: string;

  // Step 3 — WhatsApp delivery
  whatsapp_status?: "pending" | "sent" | "failed";
  whatsapp_message_id?: string;
  whatsapp_error?: string;
  whatsapp_sent_at?: string;
}

export interface AgentLog {
  id: string;
  type: "log" | "thought" | "business_saved" | "error" | "complete";
  message?: string;
  step?: number;
  thought?: string;
  action?: string;
  parameters?: unknown;
  timestamp: string;
}

export interface BackendStatus {
  database: {
    connected_to_mongodb: boolean;
    storage_type: "mongodb" | "file";
    file_path: string | null;
  };
  config: {
    openrouter_api_key_configured: boolean;
    search_provider: string;
    google_places_api_key_configured: boolean;
    serper_api_key_configured: boolean;
    whatsapp_configured: boolean;
  };
}

export interface SettingsForm {
  openrouter_api_key: string;
  mongodb_uri: string;
  search_provider: string;
  google_places_api_key: string;
  serper_api_key: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
}

export type SortBy = "newest" | "rating" | "reviews";

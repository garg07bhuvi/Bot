import { getDatabaseStatus, getSettings } from "@/lib/store";
import type { BackendStatus } from "@/lib/types";

export async function GET() {
  const settings = await getSettings();
  const status: BackendStatus = {
    database: await getDatabaseStatus(),
    config: {
      openrouter_api_key_configured: Boolean(settings.openrouter_api_key),
      search_provider: settings.search_provider,
      google_places_api_key_configured: Boolean(settings.google_places_api_key),
      serper_api_key_configured: Boolean(settings.serper_api_key),
      whatsapp_configured: Boolean(settings.leapcrew_api_key),
    },
  };
  return Response.json(status);
}

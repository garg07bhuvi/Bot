import type { NextRequest } from "next/server";
import { planSearch } from "@/lib/openrouter";
import { SEARCH_PROVIDERS, DEFAULT_SEARCH_PROVIDER } from "@/lib/search-providers";
import { getSettings, saveBusiness } from "@/lib/store";

export const dynamic = "force-dynamic";

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) return new Response("Missing query", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => controller.enqueue(encoder.encode(sseEvent(data)));

      try {
        send({ type: "log", message: `Received query: ${query}` });

        const settings = await getSettings();
        if (!settings.openrouter_api_key) {
          send({ type: "error", message: "OpenRouter API key isn't configured. Add it in Settings." });
          return;
        }

        const plan = await planSearch(query, settings.openrouter_api_key);
        send({
          type: "thought",
          step: 1,
          thought: plan.thought,
          action: "search_google_maps",
          parameters: { query, location: plan.location, category: plan.osmValue },
        });

        const provider =
          SEARCH_PROVIDERS[settings.search_provider] ?? SEARCH_PROVIDERS[DEFAULT_SEARCH_PROVIDER];
        const businesses = await provider(query, plan, settings);

        // Redesign + WhatsApp delivery need name, phone, website, and location —
        // a business missing any of those can't complete the pipeline.
        let savedCount = 0;
        for (const business of businesses) {
          const hasWebsite = !!business.website?.trim();
          const hasPhone = !!business.phone_number?.trim();
          const hasName = !!business.name?.trim();
          const hasLocation =
            business.latitude !== null &&
            business.longitude !== null &&
            business.latitude !== 0 &&
            business.longitude !== 0;

          const shouldAutoSave = hasWebsite && hasPhone && hasName && hasLocation;

          if (shouldAutoSave) {
            savedCount++;
            await saveBusiness(business);
            send({
              type: "business_saved",
              message: `Auto-saved ${business.name} (has website, phone, location)`,
              business: { ...business, autoSaved: true },
            });
          } else {
            send({
              type: "business_saved",
              message: `Scouted ${business.name}`,
              business,
            });
          }
        }

        send({
          type: "complete",
          message: `Found ${businesses.length} businesses, saved ${savedCount} with name + phone + website + location.`,
        });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

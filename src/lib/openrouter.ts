const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash-lite";

export interface SearchPlan {
  thought: string;
  location: string;
  osmKey: string;
  osmValue: string;
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

/**
 * Asks the model to both narrate its plan (for the agent console UI) and extract
 * structured search parameters (for the free OpenStreetMap lookup): the place to
 * geocode, and the OSM tag that best matches the requested business category.
 */
export async function planSearch(query: string, apiKey: string): Promise<SearchPlan> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are a business-scouting agent parsing a Google Maps style search request.
Query: "${query}"

Respond with ONLY a JSON object (no markdown, no explanation) with these fields:
- "thought": one short sentence describing your plan, for a UI log
- "location": the place name to geocode (city/town/area) extracted from the query
- "osm_key": the OpenStreetMap tag key matching the business category (one of: amenity, shop, leisure, tourism, healthcare, office)
- "osm_value": the OpenStreetMap tag value for that category (e.g. cafe, restaurant, bar, bakery, pharmacy, hotel, books, supermarket, hairdresser, doctors, fitness_centre)

Example: {"thought": "Searching Google Maps for cafes in Delhi.", "location": "Delhi", "osm_key": "amenity", "osm_value": "cafe"}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter request failed: ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenRouter returned no content");

  const parsed = extractJson(content) as Partial<Record<keyof SearchPlan | "osm_key" | "osm_value", string>>;
  if (!parsed.thought || !parsed.location || !parsed.osm_key || !parsed.osm_value) {
    throw new Error("OpenRouter returned an incomplete search plan");
  }
  return {
    thought: parsed.thought,
    location: parsed.location,
    osmKey: parsed.osm_key,
    osmValue: parsed.osm_value,
  };
}

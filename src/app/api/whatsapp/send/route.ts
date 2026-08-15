import type { NextRequest } from "next/server";
import { getBusinesses, getBusinessesReadyForWhatsapp, getSettings, updateBusiness } from "@/lib/store";
import { sendRedesignReadyMessage } from "@/lib/whatsapp";

/** Delay between sends so a batch doesn't trip Meta's rate limit.
 * ponytail: fixed delay, not real throughput pacing — fine at this volume,
 * swap for a proper queue/backoff if sends grow past a handful per run. */
const SEND_DELAY_MS = 1200;

/**
 * POST /api/whatsapp/send — Step 3 of the pipeline.
 * Body: { place_id?: string }
 *   - place_id given: send to that one business (must have redesign_status "done").
 *   - omitted: sweep every eligible business (redesign done, not yet sent).
 * Call this manually, or on a schedule (Windows Task Scheduler / cron) once
 * Step 2 (redesign) is producing results.
 */
export async function POST(request: NextRequest) {
  const { place_id } = await request.json().catch(() => ({ place_id: undefined }));
  const settings = await getSettings();

  const targets = place_id
    ? (await getBusinesses()).filter((b) => b.place_id === place_id)
    : await getBusinessesReadyForWhatsapp();

  if (place_id && targets.length === 0) {
    return Response.json({ error: "Business not found." }, { status: 404 });
  }

  const results: { place_id: string; name: string; ok: boolean; error?: string }[] = [];

  for (const business of targets) {
    if (business.redesign_status !== "done") {
      results.push({ place_id: business.place_id, name: business.name, ok: false, error: "Redesign not done yet." });
      continue;
    }

    const result = await sendRedesignReadyMessage(business, settings);
    await updateBusiness(business.place_id, {
      whatsapp_status: result.ok ? "sent" : "failed",
      whatsapp_message_ids: result.messageIds,
      whatsapp_error: result.error,
      whatsapp_sent_at: result.ok ? new Date().toISOString() : undefined,
    });
    results.push({ place_id: business.place_id, name: business.name, ok: result.ok, error: result.error });

    if (targets.length > 1) await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  return Response.json({ sent: results.filter((r) => r.ok).length, total: results.length, results });
}

import type { Business, SettingsForm } from "@/lib/types";

const LEAPCREW_URL = "https://www.leapcrew.in/api/v1/messages";

/** Template must exist and be APPROVED in Meta first — see scripts/submit-whatsapp-template.mjs. */
const TEMPLATE_NAME = "freewebsiteredesign";

/** WhatsApp caps a template to one header image, so N images = N messages. */
const IMAGE_SEND_DELAY_MS = 1200;

function toE164(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return phone.trim().startsWith("+") ? `+${digits}` : `+91${digits}`;
}

async function sendImageTemplate(
  to: string,
  imageUrl: string,
  businessName: string,
  idempotencyKey: string,
  apiKey: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(LEAPCREW_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      // Per LeapCrew's own OpenAPI spec (GET /api/v1/openapi): `media` is a
      // top-level field, sibling to `template`, not nested inside it — the
      // template's body only carries {{1}} = businessName.
      body: JSON.stringify({
        to,
        media: { type: "image", url: imageUrl },
        template: { name: TEMPLATE_NAME, variables: [businessName] },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || data.message || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data.waMessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sends every image in `business.redesign_image_urls` as its own WhatsApp
 * message via LeapCrew, so the customer gets the actual redesign images —
 * not a link to go view them. Business-initiated + this number has never
 * messaged us, so each send MUST use an approved template, not free-form
 * text (confirmed working for plain text).
 *
 * KNOWN ISSUE (2026-08-15): even with the request shaped exactly per
 * LeapCrew's published OpenAPI schema, live sends fail with Meta error
 * #132012 "header: Format mismatch, expected IMAGE, received UNKNOWN" —
 * the `media` field validates (400s if malformed) but doesn't appear to
 * reach Meta's template header parameter. Looks like a LeapCrew-side bug;
 * flagged to their support. Re-test once they confirm a fix.
 *
 * WhatsApp templates carry exactly one header image each, so multiple
 * images become multiple messages, spaced out to avoid rate limits.
 */
export async function sendRedesignReadyMessage(
  business: Business,
  settings: SettingsForm
): Promise<{ ok: boolean; messageIds: string[]; error?: string }> {
  if (!settings.leapcrew_api_key) {
    return { ok: false, messageIds: [], error: "LeapCrew isn't configured. Add the API key in Settings." };
  }
  if (!business.phone_number) {
    return { ok: false, messageIds: [], error: "Business has no phone number." };
  }
  const images = business.redesign_image_urls ?? [];
  if (images.length === 0) {
    return { ok: false, messageIds: [], error: "No redesign image available yet." };
  }

  const to = toE164(business.phone_number);
  const messageIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const result = await sendImageTemplate(
      to,
      images[i],
      business.name,
      `redesign-${business.place_id}-${i}`,
      settings.leapcrew_api_key
    );
    if (!result.ok) {
      return { ok: false, messageIds, error: `Image ${i + 1}/${images.length}: ${result.error}` };
    }
    if (result.messageId) messageIds.push(result.messageId);
    if (i < images.length - 1) await new Promise((r) => setTimeout(r, IMAGE_SEND_DELAY_MS));
  }

  return { ok: true, messageIds };
}

/**
 * One-off: submits the "freewebsiteredesign" template for Meta approval.
 * Run once (or again after editing the template):
 *   node --env-file=.env.local scripts/submit-whatsapp-template.mjs
 *
 * Needs WHATSAPP_ACCESS_TOKEN (system user, template-management permission on
 * the WABA), WHATSAPP_BUSINESS_ACCOUNT_ID, and META_APP_ID (the app whose
 * token this is, needed for the resumable upload used below).
 *
 * An IMAGE header's `example.header_handle` can't be a plain URL — Meta only
 * accepts a handle from its own resumable Upload API, so this uploads one
 * sample image first and feeds the returned handle into the template.
 */
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const appId = process.env.META_APP_ID;

if (!token || !wabaId || !appId) {
  console.error("Missing WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID, or META_APP_ID in env.");
  process.exit(1);
}

async function uploadSampleImageHandle() {
  const sample = await fetch("https://placehold.co/600x400.png");
  const bytes = new Uint8Array(await sample.arrayBuffer());

  const session = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${appId}/uploads?file_length=${bytes.length}&file_type=image/png&access_token=${token}`,
    { method: "POST" }
  ).then((r) => r.json());
  if (!session.id) throw new Error(`Upload session failed: ${JSON.stringify(session)}`);

  const upload = await fetch(`https://graph.facebook.com/${API_VERSION}/${session.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    body: bytes,
  }).then((r) => r.json());
  if (!upload.h) throw new Error(`Upload failed: ${JSON.stringify(upload)}`);

  return upload.h;
}

const headerHandle = await uploadSampleImageHandle();

const template = {
  name: "freewebsiteredesign",
  category: "MARKETING",
  language: "en",
  components: [
    { type: "HEADER", format: "IMAGE", example: { header_handle: [headerHandle] } },
    {
      type: "BODY",
      text: "Hi! We put together a free redesign concept for {{1}}'s website — take a look above. Reply if you'd like the full details.",
      example: { body_text: [["Sunrise Cafe"]] },
    },
  ],
};

const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(template),
});
const data = await res.json();

if (res.ok) {
  console.log(`Submitted — status: ${data.status ?? "PENDING"}, id: ${data.id}`);
} else {
  console.error("Submit failed:", data.error);
  process.exit(1);
}

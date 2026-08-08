---
name: website-redesign
description: Guides the agentic pipeline that turns a scouted business's existing website into a Stitch-generated redesign — crawl the live site, analyze it, write one unique per-business Stitch prompt, call Stitch MCP, and persist the result. Use when working on Step 2 (redesign) of the scout-to-WhatsApp flow, when asked to "redesign a business website" or "write a Stitch prompt for a business", or when touching redesign_status/redesign_image_urls fields on a Business record.
---

# Website Redesign Pipeline

Internal tool only — this pipeline runs against businesses already saved by the scout (Step 1) that have a `website`. It's agentic: each stage is a step an agent performs, not a fixed template applied the same way to every business. Full architecture and phased build order: `WEBSITE_REDESIGN_PLAN.md` at the repo root.

## When to use this skill

- Implementing or modifying any stage of: crawler → vision analysis → prompt-writer → Stitch MCP → persistence.
- Writing the unique redesign prompt for a specific business.
- Deciding what belongs in `redesign_status` / `redesign_image_urls` / etc. on a `Business` record.

## Pipeline stages (in order)

1. **Select candidates** — businesses where `website` is not null. Filter the existing `businesses` store; don't create a separate collection for this.
2. **Crawl + screenshot** the live `business.website` (desktop + mobile viewport).
3. **Analyze** the screenshot plus `business.category`, `business.name`, `business.short_description` → a short design brief: what looks dated, current brand colors, the tone implied by category + location (a cafe in Solan reads differently than a law firm in Mumbai).
4. **Write one unique prompt per business** — the step that makes this agentic rather than templated. Never reuse the same prompt text across businesses. Include: business name/category/location, 2–3 concrete fixes from the brief, and which brand colors to keep vs. replace. Keep it prompt-length, not a spec document.
5. **Call Stitch MCP** in Experimental/Pro mode (Gemini 2.5 Pro) — that's the mode that accepts image input, which this needs since the screenshot is the visual reference. Send `{ screenshot, unique_prompt }`.
6. **Persist** the result on the business record: `redesign_status`, `redesign_prompt`, `redesign_image_urls`, `stitch_project_id`, `redesigned_at`.

## Guardrails

- Internal tool — skip customer-facing polish, multi-tenant auth, rate-limit UX. Do add a bounded retry (e.g. 3 attempts) on Stitch/crawler failure, since this runs unattended.
- Sending the redesign to the business over WhatsApp is a separate, later step — out of scope here.
- Don't touch Step 1 (scouting/search) code as part of this pipeline unless a bug there is blocking Step 2.

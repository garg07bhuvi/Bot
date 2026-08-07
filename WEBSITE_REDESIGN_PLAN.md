# Website Redesign Pipeline — Implementation Plan

Step 2 of the product flow: **scout → redesign (this doc) → WhatsApp delivery (later, separate)**.

Internal tool only. Not customer-facing. Agentic: each stage is an agent decision, not a fixed template applied identically to every business.

## Goal

For businesses already saved by the scout (Step 1) that have a `website`, generate a redesigned version of their site so it's ready to hand to the (future, out-of-scope) WhatsApp delivery step.

## Current state

- `Business` (`src/lib/types.ts`) already has `website: string | null` — no schema change needed to identify candidates.
- `store.ts` persists to MongoDB, falling back to a local JSON file (`getBusinesses`, `saveBusiness`).
- Nothing related to redesign exists yet: no crawler, no vision analysis, no prompt-writer, no Stitch MCP connection, no result fields.

## Pipeline

```
Business record where website != null
        │
        ▼
Crawler + Screenshot Service        (fetch the live site, desktop + mobile)
        │
        ▼
Vision + LLM Analysis Agent
  reads screenshot + business.category/name/short_description
  → design brief: what's dated, current brand colors, category/location vibe
        │
        ▼
Prompt-Writer Agent                 ("the AI in between")
  turns the brief into ONE unique Stitch prompt for this business —
  never a shared template across businesses
        │
        ▼
Stitch MCP  (Experimental/Pro mode — accepts image input)
  input: { screenshot, unique_prompt }
  output: redesigned HTML/CSS + preview images
        │
        ▼
Persisted on the business record
  redesign_status, redesign_prompt, redesign_image_urls,
  stitch_project_id, redesigned_at
```

## Data model additions (planned — not yet implemented)

Extend `Business` in `src/lib/types.ts`:

| field | type | notes |
|---|---|---|
| `redesign_status` | `"pending" \| "in_progress" \| "done" \| "failed"` | absent = not yet attempted |
| `redesign_prompt` | `string` | the unique prompt the Prompt-Writer agent generated, kept for audit/debugging |
| `redesign_image_urls` | `string[]` | Stitch output, what the later WhatsApp step will send |
| `stitch_project_id` | `string` | for revisiting/editing the design in Stitch directly |
| `redesigned_at` | `string` | ISO timestamp |

Candidate selection is a **filter** (`website != null`) on the existing `businesses` store/collection — no second collection.

## Open dependencies

- **Stitch MCP is not connected to this project yet.** Needs the official Google Cloud Stitch MCP server (OAuth-based) authenticated before the Stitch-call stage can run for real.
- **Crawler/screenshot mechanism not chosen** — headless browser (e.g. Playwright) vs. a hosted screenshot API. Either works; pick whichever needs the least new infra.

## Phased build order

1. **Data model** — add the fields above to `Business`, add a `getBusinessesWithWebsite()` filter helper in `store.ts`.
2. **Crawler + screenshot service** — fetch `business.website`, capture desktop + mobile screenshots.
3. **Vision analysis agent** — screenshot + business metadata → design brief.
4. **Prompt-writer agent + Stitch MCP call** — design brief → unique prompt → Stitch call → raw result.
5. **Persistence + a minimal internal view** — save result fields, and a way to eyeball outputs before the WhatsApp step is built on top.

## Explicitly out of scope right now

- Sending redesigns via WhatsApp (Step 3 — separate service, later).
- A second collection/table for "has website" businesses — a filter covers it.
- Customer-facing UI, multi-tenant auth, rate-limit UX — internal tool.

See the [`website-redesign` skill](.claude/skills/website-redesign/SKILL.md) for the agent-facing how-to when actually building or extending this pipeline.

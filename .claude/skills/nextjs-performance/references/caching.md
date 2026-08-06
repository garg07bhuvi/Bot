# Caching, Cache Components, and revalidation (Next.js 16)

Verify anything here against `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
and `03-api-reference/01-directives/use-cache.md` for the installed version.

## Contents

- [Two models, pick one](#two-models-pick-one)
- [Enabling Cache Components](#enabling-cache-components)
- [`use cache`](#use-cache)
- [`cacheLife` profiles](#cachelife-profiles)
- [What lands in the static shell](#what-lands-in-the-static-shell)
- [Runtime APIs and cached functions](#runtime-apis-and-cached-functions)
- [Random values and timestamps](#random-values-and-timestamps)
- [Revalidation](#revalidation)
- [ISR](#isr)
- [Migration checklist from 15](#migration-checklist-from-15)

## Two models, pick one

Next.js 16 has two caching models, and mixing advice between them is the main
source of wrong answers:

- **Cache Components** (`cacheComponents: true`) — data is dynamic by default,
  you opt *into* caching with `'use cache'`. PPR is the default rendering
  behavior. This is the direction the framework is going.
- **The previous model** — `fetch` caching, route segment configs
  (`dynamic`, `revalidate`), `unstable_cache`. Documented in
  `02-guides/caching-without-cache-components.md`.

Check `next.config.ts` for `cacheComponents` before advising on either. If the
project hasn't enabled it, don't casually flip it on — it surfaces build errors
for every uncached read outside a `<Suspense>` boundary. Treat it as a migration
with its own PR (`02-guides/migrating-to-cache-components.md`).

## Enabling Cache Components

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
export default nextConfig
```

Requires the Node.js runtime — routes exporting `runtime = 'edge'` must migrate.
It also enables React `<Activity>` for navigation, so previous routes stay
mounted with their state preserved instead of unmounting.

## `use cache`

The directive caches the return value of an async function or component.
Arguments and closed-over values become part of the cache key.

**Data-level** — cache the fetch, share it across components:

```ts
import { cacheLife } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM users')
}
```

**UI-level** — cache a component, page, or layout's rendered output:

```tsx
export default async function Page() {
  'use cache'
  cacheLife('days')
  cacheTag('posts')

  const posts = await getPosts()
  return <PostList posts={posts} />
}
```

A file-level `'use cache'` caches every exported function in that file.

Variants:

- `'use cache: private'` — for functions that read `cookies()` / `headers()` /
  `searchParams` directly. Cached in the browser only, never in the static shell.
- `'use cache: remote'` — durable, shared cache. Reach for this when in-memory
  caching won't survive between serverless invocations.

Plain `'use cache'` entries gated behind request data are cached **in memory** by
default, which does not persist across serverless requests — they may
re-evaluate every request. That surprises people.

## `cacheLife` profiles

Pair every cache directive with an explicit `cacheLife`. Omitting it applies the
implicit `default` profile and makes nested cache scopes hard to reason about.

| Profile | Use case | `stale` | `revalidate` | `expire` |
|---|---|---|---|---|
| `default` | Standard content | 5 min | 15 min | never |
| `seconds` | Real-time data | 30 s | 1 s | 1 min |
| `minutes` | Frequently updated | 5 min | 1 min | 1 hour |
| `hours` | Several updates a day | 5 min | 1 hour | 1 day |
| `days` | Daily updates | 5 min | 1 day | 1 week |
| `weeks` | Weekly updates | 5 min | 1 week | 30 days |
| `max` | Rarely changes | 5 min | 30 days | 1 year |

- `stale` — how long the client router serves cached content with no server check.
  Also decides whether the result can join the route's App Shell.
- `revalidate` — after this, the next request serves stale and refreshes in background.
- `expire` — after this long with no requests, the next request blocks on fresh content.

Call `cacheLife` inside the same function that declares the cache, and make sure
exactly one call runs per invocation (branches are fine). It cannot be called at
module scope. Custom profiles and overrides of the built-ins go in
`next.config.ts` under `cacheLife` — if you redefine a built-in, document it,
because `cacheLife('hours')` will no longer mean what a reader expects.

## What lands in the static shell

At build time Next.js renders the tree and sorts each component:

- `'use cache'` results → in the shell (as long as the lifetime isn't too short)
- `<Suspense>` → the **fallback** is in the shell; content streams at request time
- Predictable values (module imports, `fs.readFileSync`, pure computation) → in
  the shell automatically
- Random values / timestamps → must be handled explicitly (below)

Everything else is a build error under Cache Components, with the dev overlay
pointing at the fix. This validation is the point: it guarantees every route
produces a shell, which is what keeps direct navigations instant.

**Maximizing the shell is the single highest-leverage optimization.** The deeper
the async work sits, the more of the page prerenders. See the "push `await` down
the tree" section of SKILL.md.

Read local, request-independent resources (config files, fonts) at **module
scope** rather than during render — otherwise they count as uncached reads.

## Runtime APIs and cached functions

`cookies()`, `headers()`, `searchParams`, and dynamic `params` are runtime data.
Components reading them go inside `<Suspense>`. Under Cache Components this no
longer opts the whole route into dynamic rendering — only that subtree streams.

To cache work that depends on a runtime value, extract the value in an uncached
component and pass it as an argument:

```tsx
async function ProfileContent() {          // not cached — reads the cookie
  const session = (await cookies()).get('session')?.value
  return <CachedContent sessionId={session} />
}

async function CachedContent({ sessionId }: { sessionId: string }) {
  'use cache'
  cacheLife('minutes')
  return <div>{await fetchUserData(sessionId)}</div>   // sessionId is in the cache key
}
```

## Random values and timestamps

`Math.random()`, `Date.now()`, and `crypto.randomUUID()` are errors during
prerender. Two fixes, depending on intent:

```tsx
// Unique per request: defer to request time, then stream it
await connection()
const id = crypto.randomUUID()
```

```tsx
// Shared across users until revalidation: cache it
'use cache'
const buildId = crypto.randomUUID()
```

`performance.now()` is exempt — it's for telemetry, not rendering.

## Revalidation

Three APIs with different semantics. Picking the wrong one is a common bug.

| API | Semantics | Where |
|---|---|---|
| `revalidateTag(tag, profile)` | Marks stale; readers see stale content while it refreshes | anywhere |
| `updateTag(tag)` | Expires **and** refreshes in the same request — read-your-writes | Server Actions only |
| `refresh()` | Refreshes the client router | Server Actions only |

```ts
'use server'
import { revalidateTag, updateTag } from 'next/cache'

// Blog post edited — a few seconds of staleness is fine
export async function publishPost(id: string) {
  await db.posts.publish(id)
  revalidateTag('posts', 'max')   // note the required second argument
}

// User edited their own profile — they must see it immediately
export async function updateProfile(userId: string, profile: Profile) {
  await db.users.update(userId, profile)
  updateTag(`user-${userId}`)
}
```

Rule of thumb: if the user who triggered the mutation would be confused by seeing
old data, use `updateTag`. Otherwise `revalidateTag` is cheaper.

## ISR

With Cache Components, ISR falls out of `cacheLife` + `generateStaticParams`.
Params known at build time get concrete shells; unknown params get the reusable
**App Shell** and fill in after first visit. Details in
`02-guides/incremental-static-regeneration-cache-components.md`.

Always provide `generateStaticParams` for dynamic segments you can enumerate —
without it, every navigation to a new param waits on a server render.

## Migration checklist from 15

- `experimental.ppr` / `experimental_ppr` / `experimental.dynamicIO` /
  `experimental.useCache` → `cacheComponents: true`
- `unstable_cacheLife` / `unstable_cacheTag` → `cacheLife` / `cacheTag`
- `revalidateTag('x')` → `revalidateTag('x', 'max')` (or `updateTag` in actions)
- `unstable_rootParams` → `next/root-params`
- Route segment `runtime = 'edge'` → Node.js runtime

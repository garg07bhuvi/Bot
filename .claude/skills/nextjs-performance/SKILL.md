---
name: nextjs-performance
description: Best practices and performance optimization for Next.js App Router apps (Next.js 15/16+) — rendering model, Cache Components and `use cache`, static shell / PPR, prefetching and instant navigation, bundle size, images, fonts, and Core Web Vitals. Use this skill whenever the user is writing, reviewing, refactoring, or debugging Next.js code — pages, layouts, Server/Client Components, route handlers, Server Actions, `next.config.ts`, caching, revalidation, middleware/proxy — or asks why their Next app is slow, has a big bundle, slow navigations, waterfalls, hydration errors, or bad LCP/CLS/TTFB. Also use when upgrading Next.js versions or when the user mentions Turbopack, PPR, `use cache`, `cacheLife`, `revalidateTag`, ISR, streaming, or Suspense in a Next.js context. Trigger it even when the request sounds like a small edit — Next.js 16 changed enough APIs that "obvious" answers from memory are frequently wrong.
---

# Next.js performance and best practices

Next.js changes fast, and version 16 was a large breaking release. The most
common failure mode here is not writing bad code — it's writing Next.js 14/15
code confidently in a Next.js 16 project. Start by grounding yourself in the
version actually installed.

## Step 0: ground yourself in the installed version (do this first)

```bash
cat node_modules/next/package.json | head -5     # exact version
ls node_modules/next/dist/docs/                  # version-matched docs ship with the package
```

Next.js ships its own docs inside the package. They are the source of truth for
the installed version — your training data is not. Before writing code that
touches an API you haven't verified this session, read the matching file under
`node_modules/next/dist/docs/01-app/`. In a monorepo, resolve `next` from the app
directory, not the repo root.

If `node_modules` isn't installed, install dependencies first — a few minutes of
install beats shipping an API that was removed.

Useful paths:

| Topic | Path under `node_modules/next/dist/docs/01-app/` |
|---|---|
| Breaking changes | `02-guides/upgrading/version-16.md` |
| Caching model | `01-getting-started/08-caching.md`, `03-api-reference/01-directives/use-cache.md` |
| Instant navigation | `02-guides/instant-navigation.md` |
| Bundles | `02-guides/package-bundling.md` |
| Config options | `03-api-reference/05-config/01-next-config-js/` |
| Production checklist | `02-guides/production-checklist.md` |

## Next.js 16 facts that most often get written wrong

These are the ones worth memorizing, because getting them wrong produces code
that type-checks in your head and fails at runtime.

- **Request APIs are async, with no sync fallback.** `cookies()`, `headers()`,
  `draftMode()`, and the `params` / `searchParams` props are Promises. The
  synchronous compatibility layer from 15 is gone. Run
  `npx next typegen` to get the `PageProps<'/route'>` and `LayoutProps<'/route'>`
  helpers instead of hand-writing prop types.
- **Turbopack is the default for `next dev` *and* `next build`.** Drop
  `--turbopack` from scripts. Config moved from `experimental.turbopack` to a
  top-level `turbopack` key. A project with a custom `webpack` config will *fail*
  `next build` unless it passes `--webpack` or migrates.
- **`middleware.ts` is now `proxy.ts`**, exporting `proxy` instead of
  `middleware`. It runs on the Node.js runtime only — `edge` is not supported
  there. Flags renamed too (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`).
- **PPR, `dynamicIO`, and `useCache` collapsed into one flag: `cacheComponents: true`.**
  `experimental.ppr`, `experimental_ppr`, `experimental.dynamicIO`, and
  `experimental.useCache` are removed. Enabling `cacheComponents` is not a
  rename — it changes the rendering model (see `references/caching.md`).
- **`cacheLife` and `cacheTag` are stable** — drop the `unstable_` prefix.
- **`revalidateTag` takes a second argument**: a cacheLife profile, e.g.
  `revalidateTag('posts', 'max')`. The one-arg form is deprecated.
- **Parallel route slots require an explicit `default.js`** or the build fails.
- **`next build` no longer prints `size` / `First Load JS`.** Those numbers were
  inaccurate under RSC. Measure with Lighthouse, field Core Web Vitals, or
  `next experimental-analyze`.
- **Node 20.9+ and TypeScript 5.1+** are the floor.

`next/image` defaults tightened in 16 — see `references/performance.md`.

## The mental model to optimize against

Next.js draws the static/dynamic boundary at the **component** level, not the
route level. A single page ships a static shell immediately and streams the
dynamic parts into their fallbacks. Nearly every performance question in an App
Router app reduces to one of:

1. **How much of this page can be in the static shell?** (bigger shell = faster
   first paint, and it can be served from a CDN)
2. **Does this navigation have to wait on the network?** (prefetch + Suspense
   structure decide this)
3. **How much JavaScript reaches the browser?** (`"use client"` placement is the
   main lever)

Work those three in order. Micro-optimizations below them rarely matter.

## Core practices

### Keep `"use client"` at the leaves

Server Components are the default and cost zero client bytes. A `"use client"`
directive marks a boundary: everything imported below it ships to the browser.
The most common bundle problem in App Router apps is a `"use client"` near the
top of a tree that drags a whole subtree client-side.

Push interactivity into small leaf components and pass Server Components through
as `children` rather than importing them under the boundary:

```tsx
// app/page.tsx — stays a Server Component
import { Collapsible } from './collapsible' // "use client"
import { ExpensiveServerTable } from './table'

export default function Page() {
  return (
    <Collapsible>
      <ExpensiveServerTable /> {/* rendered on the server, passed as children */}
    </Collapsible>
  )
}
```

### Push `await` down the tree

Awaiting `params`, `cookies()`, `headers()`, or a fetch high in the tree blocks
everything below it from prerendering. Awaiting it deep — inside a `<Suspense>`
boundary — lets the rest of the page ship in the static shell.

```tsx
// Blocks the whole layout from prerendering
export default async function Layout({ children, params }: LayoutProps<'/shop/[slug]'>) {
  const { slug } = await params
  return <div><Sidebar /><h1>{slug}</h1>{children}</div>
}

// Sidebar, children, and the fallback all make it into the static shell
export default function Layout({ children, params }: LayoutProps<'/shop/[slug]'>) {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<h1>Loading…</h1>}>
        {params.then(({ slug }) => <h1>{slug}</h1>)}
      </Suspense>
      {children}
    </div>
  )
}
```

Passing the unawaited promise to a child component works too, and reads better
for anything non-trivial.

### Kill waterfalls

Sequential `await`s in one component serialize the requests. Start them
together:

```tsx
const artistData = getArtist(username)   // no await — request starts now
const albumsData = getAlbums(username)
const [artist, albums] = await Promise.all([artistData, albumsData])
```

`Promise.all` rejects on the first failure; use `Promise.allSettled` when partial
results are acceptable. Layouts and pages already render in parallel, so this
only matters *within* a component.

To share one result across components in the same request, wrap the fetcher in
`React.cache` — it memoizes per request, with no cross-request sharing:

```ts
import { cache } from 'react'
export const getUser = cache(async () => (await fetch('…')).json())
```

Never call your own Route Handlers from a Server Component — that's an extra
network hop to your own server. Call the data layer directly.

### Stream instead of blocking

Anything that reads uncached data or runtime APIs belongs inside `<Suspense>`,
so its fallback ships in the static shell and the content streams in. Use
`loading.tsx` for route-level fallbacks and inline `<Suspense>` for finer
boundaries.

A `<Suspense>` boundary does not by itself make a component dynamic — synchronous
work still completes during prerender.

### Cache deliberately

Read `references/caching.md` before touching caching in a Next.js 16 project.
The short version: enable `cacheComponents`, mark cacheable async functions and
components with `'use cache'`, and pair **every** one with an explicit
`cacheLife(...)` so its lifetime is visible at the call site.

## When to load the reference files

- `references/caching.md` — the Cache Components model, `use cache` variants,
  `cacheLife` profiles, revalidation (`revalidateTag` / `updateTag` / `refresh`),
  ISR, and what makes it into the static shell. Read this for *any* caching,
  revalidation, or PPR work.
- `references/performance.md` — bundle analysis and reduction, prefetching and
  instant navigation, images, fonts, third-party scripts, CSS strategy, React
  Compiler, and how to actually measure. Read this for "it's slow" or "the
  bundle is too big".

## Reviewing existing Next.js code

Look for these in roughly this order — they're ordered by how much impact they
usually have:

1. `"use client"` in a layout or page that could be a leaf component instead
2. `await` on `params` / `cookies()` / `headers()` / fetches at the top of a
   layout or page, blocking the static shell
3. Uncached data reads with no `<Suspense>` around them
4. Sequential `await`s that could be `Promise.all`
5. `'use cache'` without a `cacheLife` (implicit `default` profile, hard to reason about)
6. `<img>` instead of `next/image`; missing `sizes` on responsive images; missing
   `priority` on the LCP image
7. Web fonts loaded via `<link>` or CSS `@import` instead of `next/font`
8. Third-party scripts not using `next/script` with an appropriate `strategy`
9. Heavy client-only libraries imported statically instead of via `next/dynamic`
10. Leftover Next.js 15 APIs: `middleware.ts`, `experimental.ppr`, `unstable_cacheLife`,
    single-arg `revalidateTag`, `images.domains`, `next/legacy/image`

Report findings with the file and line, the concrete fix, and — where it isn't
obvious — which metric it moves. A bundle-size note without a number is not very
actionable; prefer measuring with `next experimental-analyze` over guessing.

## Verify before claiming a win

Performance claims need evidence. `next dev` is not representative — it disables
prefetching and skips production optimizations. Build and run production locally:

```bash
npx next build && npx next start
```

Then measure with Lighthouse (in incognito) or the Navigation Inspector in the
Next.js DevTools. If you changed something and didn't measure, say so plainly
rather than asserting an improvement.

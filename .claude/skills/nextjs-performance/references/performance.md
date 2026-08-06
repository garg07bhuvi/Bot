# Performance playbook (Next.js 16)

Verify against `node_modules/next/dist/docs/01-app/02-guides/` for the installed
version — especially `production-checklist.md`, `package-bundling.md`, and
`instant-navigation.md`.

## Contents

- [Measure first](#measure-first)
- [Bundle size](#bundle-size)
- [Navigation and prefetching](#navigation-and-prefetching)
- [Images](#images)
- [Fonts](#fonts)
- [Third-party scripts](#third-party-scripts)
- [CSS](#css)
- [React Compiler](#react-compiler)
- [Build and dev speed](#build-and-dev-speed)
- [Common symptom → cause table](#common-symptom--cause-table)

## Measure first

`next dev` is not a performance environment: prefetching is disabled and
production optimizations are off. Always measure against a production build.

```bash
npx next build && npx next start
```

- **Lighthouse in incognito** for lab numbers. Pair with field data — lab results
  routinely disagree with what real users experience.
- **`useReportWebVitals`** to ship Core Web Vitals to your analytics.
- **Next.js DevTools → Navigation Inspector** (requires `cacheComponents`) with
  "Pause on navigations" on: freezes the static shell on refresh and the
  prefetched UI on link clicks, so you can see exactly what a user sees at t=0.
- **`next experimental-analyze`** (v16.1+) for the bundle treemap with import
  chains. `--output` writes a static file for sharing or before/after diffing.

Note that `next build` in 16 no longer reports `size` / `First Load JS` — those
numbers were unreliable under RSC and were removed. Don't look for them.

## Bundle size

The lever that matters most is **where `"use client"` sits**. Everything imported
below a client boundary ships to the browser. Before reaching for any config
option, check whether a boundary can move down the tree.

After that:

**`next/dynamic`** for client components and libraries that aren't needed on
first paint:

```tsx
'use client'
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./editor'))                // separate chunk
const Chart = dynamic(() => import('./chart'), { ssr: false })  // client-only
```

`ssr: false` only works inside a Client Component. Conditional rendering
(`{open && <Editor />}`) is what actually defers the download.

**`optimizePackageImports`** for barrel-file packages that export hundreds of
modules:

```ts
// next.config.ts
experimental: { optimizePackageImports: ['my-icon-lib'] }
```

Already optimized by default: `lucide-react`, `date-fns`, `lodash-es`, `ramda`,
`antd`, `@ant-design/icons`, `@headlessui/react`, `@heroicons/react/*`,
`@mui/material`, `@mui/icons-material`, `recharts`, `react-icons/*`, `rxjs`,
`react-use`, `@tabler/icons-react`, `effect`, and others. Don't add these again.

**`serverExternalPackages`** to keep server-only native/heavy deps out of the
bundling pipeline entirely.

Before adding a dependency, check its cost (bundlephobia, packagephobia). A date
formatter that costs 70 KB to avoid ten lines of `Intl.DateTimeFormat` is a bad
trade.

## Navigation and prefetching

Next.js 16 overhauled routing: layouts are deduplicated across prefetches, and
prefetching is incremental (only the parts not already cached). Expect *more*
requests with a much lower total transfer. That's the intended trade.

**Partial Prefetching** — one reusable App Shell per route instead of one
prefetch per visible link:

```ts
// next.config.ts
{ cacheComponents: true, partialPrefetching: true }
```

With it on, rendering a `<Link>` is effectively free. Adopt incrementally per
route with `export const prefetch = 'partial'` on the destination segment, then
flip the global flag and delete the per-route exports.

Per-link and per-segment controls:

- `<Link prefetch>` — also resolve per-link runtime data (`params`,
  `searchParams`, full URL) ahead of the click. Costs a server invocation per
  prefetchable link, so use it on the links that matter (checkout, primary CTA),
  not everywhere.
- `<Link prefetch={false}>` — skip prefetching for this link.
- `export const prefetch = 'force-disabled'` — never prefetch this segment.
  Good for rarely-visited authenticated pages.
- `export const instant = true` — ask Next.js to validate that navigations into
  this segment render immediately, surfacing whatever blocks them in the dev
  overlay. `instant = false` exempts a segment (and, on the root layout,
  disables static-shell validation app-wide — place it as low as possible).

**Direct visits and client navigations produce different UI.** A direct visit
renders from the document root, so any `<Suspense>` in the tree applies. A client
navigation only re-renders below the *shared* layout, so a boundary above that
point never triggers. A page that looks instant on refresh can still block on
navigation. Test both.

`experimental.staleTimes` tunes the client router cache (`static` defaults to
5 min; `dynamic` defaults to 0 — not cached).

Two things that reliably make navigation slow:

- dynamic routes with no `loading.tsx` and no `<Suspense>`
- dynamic segments with no `generateStaticParams`

## Images

Use `next/image` — it handles sizing, modern formats, lazy loading, and prevents
CLS. Next.js 16 tightened several defaults:

| Setting | 16 default | Note |
|---|---|---|
| `qualities` | `[75]` | other values are coerced to the nearest allowed one |
| `minimumCacheTTL` | 4 hours (was 60 s) | cuts revalidation cost for upstreams with no `cache-control` |
| `imageSizes` | `16` removed | shrinks the generated `srcset` |
| `maximumRedirects` | 3 (was unlimited) | |
| local IP optimization | blocked | `dangerouslyAllowLocalIP` only for private networks, understand the SSRF risk |
| `images.domains` | deprecated | use `remotePatterns` |
| `next/legacy/image` | deprecated | use `next/image` |

Local images with query strings now need `images.localPatterns` with a `search`
entry.

Practices that matter:

- **Static-import local images** so `width`, `height`, and `blurDataURL` are
  inferred and CLS is prevented. If you can't, `await import()` inside a Server
  Component gets you the same metadata.
- **`priority`** on the LCP image (usually the hero) — and only that one.
- **`sizes`** on any image using `fill` or responsive widths, or the browser
  downloads a larger candidate than it needs.
- **`placeholder="blur"`** for a blur-up on slow connections.

## Fonts

`next/font` self-hosts font files alongside your static assets — no external
request, no layout shift, and the CSS is generated with the right `size-adjust`
metrics. Load it once at the root layout and subset it:

```ts
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap' })
```

A `<link>` to Google Fonts or a CSS `@import` costs an extra round trip on the
critical path and reintroduces the layout shift `next/font` exists to prevent.

## Third-party scripts

`next/script` with a deliberate `strategy`:

- `afterInteractive` (default) — analytics and most tags
- `lazyOnload` — chat widgets, anything non-essential
- `beforeInteractive` — only for things that genuinely must run first (rare;
  it blocks)
- `worker` — offload to a web worker (experimental)

Third-party scripts are frequently the largest single cost on a page and the
easiest win. Check what's actually loaded before optimizing your own code.

## CSS

`experimental.cssChunking` defaults to `true` (merge where possible) in both
bundlers. Most apps should leave it alone. Reach for another value only with a
reason:

- Turbopack `'graph'` — cost-based grouping across routes, cutting the unused
  CSS a route downloads at the cost of more requests. Tune with `requestCost`
  (default 20000 bytes, higher = fewer/larger chunks) and `weightDistribution`.
- webpack `'strict'` — for correctness when import order matters between
  stylesheets; `false` disables merging.

`experimental.inlineCss` turns CSS `<link>` tags into inline `<style>`:

- **Enable** with atomic CSS (Tailwind) when first-time visitors matter — it
  removes the render-blocking CSS round trip, improving FCP and LCP.
- **Skip** with large CSS bundles or a returning-visitor-heavy audience —
  inlined CSS can't be cached separately and inflates TTFB on every response.

To find dead CSS, use Chrome DevTools' Coverage panel — but remember it counts
`:hover`/`:focus`/JS-toggled classes as unused until you trigger them.

## React Compiler

Stable in 16, off by default. It auto-memoizes components, removing most manual
`useMemo`/`useCallback`.

```ts
// next.config.ts
{ reactCompiler: true }
```

Needs `babel-plugin-react-compiler` as a dev dependency. It runs through Babel,
so **dev and build times go up**. Worth it for render-heavy client apps; a poor
trade for a mostly-server-rendered site with few Client Components.

## Build and dev speed

- Turbopack is the default for dev and build in 16, with filesystem caching
  enabled by default across restarts (`turbopackFileSystemCache` to configure).
- `next dev` and `next build` now use separate output directories (`.next/dev`)
  and can run concurrently.
- A `webpack` config in `next.config.ts` fails `next build` — migrate to
  `turbopack` options, or pass `--webpack` deliberately.
- `next dev` no longer loads the config twice, so `process.argv.includes('dev')`
  in `next.config.js` is now `false`. Check `NODE_ENV` instead.

## Common symptom → cause table

| Symptom | Usual cause | Fix |
|---|---|---|
| Slow first paint on a mostly-static page | `await` on `params`/`cookies()`/fetch high in the tree | push the await down, wrap in `<Suspense>` |
| Large client bundle | `"use client"` too high | move the boundary to leaves; pass Server Components as `children` |
| Slow navigation, fast refresh | `<Suspense>` sits above the shared layout | add a boundary below it, or `export const instant = true` to find the blocker |
| Every navigation hits the server | no `generateStaticParams`, no `loading.tsx` | add both |
| High TTFB | uncached expensive query on the render path | `'use cache'` + `cacheLife` |
| Poor CLS | `<img>`, or `next/image` without dimensions; web font via `<link>` | static import / explicit dims; `next/font` |
| Poor LCP | hero image lazy-loaded, or render-blocking CSS | `priority` on the LCP image; consider `inlineCss` |
| Waterfall in the network tab | sequential `await`s in one component | `Promise.all` |
| Duplicate identical requests per render | same fetcher called in several components | `React.cache` |

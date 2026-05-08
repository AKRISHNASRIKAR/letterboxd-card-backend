# Letterboxd Card — System Overview

## What this project does

A user enters their Letterboxd username on the frontend. The backend scrapes their public profile page, extracts stats and recent film data, renders a 1100×340 SVG stat card, and returns it as an image. The card embeds in any `<img>` tag — GitHub READMEs, Notion pages, portfolios.

---

## Architecture

```
lb-card-fe  (Next.js)          lb-card-be  (Express + Node)
─────────────────────          ──────────────────────────────
app/page.tsx                   api/index.ts  ← Vercel serverless entry
  └─ UserInput                   └─ src/server.ts  ← Express app
  └─ PreviewCard  ────────────►    └─ /api/card
  └─ CopyableLink  ───────────►    └─ /api/stats
  └─ lib/api.ts                    └─ /api/films
                                   └─ /api/health
```

Both repos are deployed independently on Vercel. The frontend uses `NEXT_PUBLIC_API_URL` to know where to send requests.

---

## Backend — how each layer works

### 1. Entry point (`api/index.ts`, `src/server.ts`)

`src/server.ts` creates the Express app, wires up middleware (Helmet, CORS, rate limiter), mounts all routes under `/api`, and exports the `app` object.

`api/index.ts` is the Vercel serverless entry — it simply imports and re-exports the Express app as a default export. Vercel wraps it and handles `app.listen()` itself. Local dev uses `src/index.ts` which calls `app.listen()` directly.

`app.set('trust proxy', 1)` is set first so Express correctly reads `X-Forwarded-For` headers from Vercel's proxy, which is required for `express-rate-limit` to work properly in production.

### 2. Middleware stack

| Middleware | Purpose |
|---|---|
| `helmet` | Sets security HTTP headers (CSP, HSTS, etc.) |
| `cors` | Allows all origins — cards are embedded on external sites |
| `express.json()` | Parses JSON request bodies |
| `express-rate-limit` | 30 requests per IP per minute; `validate.xForwardedForHeader:false` silences Vercel proxy warning |

### 3. Routes (`src/routes/`)

All routes live under `/api`. The router mounts them:

```
GET /api/health          → quick liveness check
GET /api/stats?user=X    → returns LetterboxdStats as JSON
GET /api/card?user=X     → returns SVG image
GET /api/films?user=X    → returns recent films as JSON
GET /api/lists?user=X    → returns user's public lists as JSON
```

Each route runs `validate(schema)` middleware first (Zod), which puts the validated params in `res.locals.params` so controllers don't have to repeat validation logic.

### 4. Scraper (`src/services/letterboxd/scraper.ts`)

Uses `fetch` with browser-like headers (User-Agent, Accept, Referer etc.) to avoid Letterboxd bot detection. Requests are:
- **Throttled** by `p-throttle` to max 2 concurrent requests per second
- **Retried** up to 3 times with exponential backoff via `p-retry`
- **Proxied** through allorigins.win or corsproxy.io as fallbacks if the direct fetch fails

The scraper exposes `fetchProfile`, `fetchFilms`, and `fetchLists` — each hits the corresponding Letterboxd URL.

### 5. Parser (`src/services/letterboxd/parser.ts`)

Loads the raw HTML into Cheerio (server-side jQuery-like DOM). Uses CSS selectors defined in `selectors.ts` to extract:

- Username, display name, member since
- Avatar URL (from `.profile-avatar img`)
- Stats: total films, this year, following, followers, lists
- Recent films from `#recent-activity .react-component[data-item-slug]`

**Film poster extraction — the important part:**
Letterboxd renders its film grids entirely client-side. The `img` tag in the server-rendered HTML always has `src="https://s.ltrbxd.com/.../empty-poster-150.png"` (the placeholder). The real numeric film ID is encoded in the `data-postered-identifier` attribute as JSON:
```json
{"lid":"21aa","uid":"film:48113","type":"film"}
```
The parser reads this attribute and extracts the numeric ID (`48113`) from `uid`.

### 6. Transformer (`src/services/letterboxd/transformer.ts`)

Converts the raw parsed data into the typed `LetterboxdStats` shape.

For poster URLs it constructs the real CDN URL from the numeric film ID:
```
filmId "48113" → path "4/8/1/1/3/48113"
URL: https://a.ltrbxd.com/resized/film-poster/4/8/1/1/3/48113-van-helsing-0-230-0-345-crop.jpg
```

This CDN URL returns the actual 29KB+ JPEG poster — not the placeholder. The `posterImgSrc` scraped from the HTML is only used as a last resort when no `filmId` was found.

### 7. Cache (`src/services/cache.service.ts`)

Wraps Upstash Redis (serverless-friendly, HTTP-based Redis). Stats are cached for 1 hour (`ttl: 3600`). Cache keys follow the pattern `stats:v3:<username>`. Both the stats and card controllers check the cache first and only scrape Letterboxd on a miss.

### 8. Renderer (`src/services/card/renderer.tsx`)

Uses **Satori** to render a React JSX tree directly to SVG — no browser required. The card is a fixed 1100×340 pixel layout divided into three columns:

```
┌──────────────┬────────────────────────────┬─────────────────────────────┐
│  User panel  │  All-time stats (5 values) │  Recent watches (4 posters) │
│  170px       │  400px                     │  flex:1                     │
├──────────────┴────────────────────────────┴─────────────────────────────┤
│  ● ● ●   letterboxd-card.vercel.app                     Updated Xm ago  │
└─────────────────────────────────────────────────────────────────────────┘
```

Before calling Satori the renderer:
1. **Loads fonts** — fetches Inter 400/700 from jsDelivr (falls back to Google Fonts static CDN). Fonts are module-level cached so they're only fetched once per cold start.
2. **Converts images to base64** — fetches avatar and poster images and converts them to `data:image/<mime>;base64,...` strings. Satori cannot load images by URL at render time.
3. **Rejects bad images** — VP8L (lossless) WebP files crash Satori's internal wasm decoder. Any image under 200 bytes or identified as VP8L is dropped and replaced with a text-only placeholder div.

The JSX uses Satori's `tw` prop for layout utilities (`tw="flex items-center justify-center"`) and inline `style={}` only for values that can't be expressed in default Tailwind (custom hex colours, specific pixel dimensions).

---

## Frontend — how each part works

### `lib/api.ts`

All HTTP calls go through this module. `BASE` is read from `NEXT_PUBLIC_API_URL` — this env var must be set to the deployed backend URL in Vercel project settings. Without it, URLs become relative paths which Next.js can't route to the Express backend.

### `app/page.tsx`

The homepage. Has no server-side data fetching — it's a client component. Manages one piece of state: `username` (the currently generated username). Renders `UserInput`, then conditionally renders `PreviewCard` and `CopyableLink` once a username is set.

### `components/PreviewCard.tsx`

Renders a `<img>` whose `src` is `getCardUrl(username)` — the backend's `/api/card` URL. The browser itself fetches the image; no JS fetch/axios call is needed. Shows a skeleton while loading and an error state if the backend returns non-200.

### `components/UserInput.tsx`

Controlled text input. On submit, strips a leading `@` and lowercases the value, then calls `onGenerate`. No API calls here — just UI.

### `components/CopyableLink.tsx`

Shows three copy-able snippets: Markdown embed, HTML embed, and the raw URL. Uses the Clipboard API with a `document.execCommand('copy')` fallback.

---

## Deployment

Both projects are connected to GitHub and auto-deploy on push to `main`.

**Backend (lb-card-be):** `vercel.json` points all routes to `api/index.ts`:
```json
{
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.ts" }]
}
```

**Frontend (lb-card-fe):** Standard Next.js Vercel deploy. Requires one environment variable:
```
NEXT_PUBLIC_API_URL = https://letterboxd-card-backend.vercel.app
```

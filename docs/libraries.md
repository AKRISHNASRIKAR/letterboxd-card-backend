# Libraries & Tools

## Backend (`lb-card-be`)

### Runtime & Framework

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4 | HTTP server and routing framework. All API routes, middleware composition, and request/response handling. |
| `typescript` | ^5 | Static typing across the entire backend. Catches shape mismatches between parser output, transformer output, and the `LetterboxdStats` type at compile time. |
| `ts-node` | ^10 | Runs TypeScript directly in Node without a build step. Used in local dev via `nodemon`. |
| `nodemon` | ^3 | Watches source files and restarts `ts-node` on change. Only used locally — Vercel builds a full bundle. |

### Security & Rate Limiting

| Package | Purpose |
|---|---|
| `helmet` | Sets security HTTP response headers: `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`, etc. One-line hardening. |
| `cors` | Enables cross-origin requests. Cards are embedded on external sites (GitHub READMEs, Notion pages), so all origins are allowed. |
| `express-rate-limit` | Limits each IP to 30 requests per minute. Requires `app.set("trust proxy", 1)` so it reads the real client IP from `X-Forwarded-For` on Vercel instead of the proxy's internal IP. |

### Scraping & HTML Parsing

| Package | Purpose |
|---|---|
| `cheerio` | Server-side HTML parsing with a jQuery-like API. Loads Letterboxd's raw HTML and exposes `$()` selectors to extract profile data, stats, and film metadata. Does not execute JavaScript — Letterboxd's client-side-rendered film grids must be parsed from the static HTML attributes (`data-postered-identifier`). |
| `p-throttle` | Wraps the scraper's `fetch` calls to enforce a maximum of 2 concurrent requests per second. Prevents Letterboxd from rate-limiting or blocking the backend IP. |
| `p-retry` | Retries failed fetch calls up to 3 times with exponential backoff. Handles transient network errors and occasional Letterboxd 5xx responses. |

### Validation

| Package | Purpose |
|---|---|
| `zod` | Schema-based validation for query parameters. Each route declares a Zod schema; the `validate` middleware runs it and stores the typed result in `res.locals.params`. Controllers read from `res.locals.params` without repeating validation. |

### Caching

| Package | Purpose |
|---|---|
| `@upstash/redis` | Serverless-friendly Redis client that communicates over HTTP/REST instead of a persistent TCP connection. Used to cache scraped stats for 1 hour (`ttl: 3600`) per username. Cache keys follow `stats:v3:<username>`. HTTP-based so it works inside Vercel's serverless function environment where long-lived TCP connections are not guaranteed. |

### SVG Rendering

| Package | Purpose |
|---|---|
| `satori` | Converts a React JSX tree to an SVG string without a browser or headless Chrome. Accepts fonts as `ArrayBuffer` and images as base64 data URLs — no runtime URL fetching. Supports a subset of CSS Flexbox for layout and a built-in `tw` prop for Tailwind utility classes. |
| `react` | Required by Satori. The renderer is a `.tsx` file that writes JSX; Satori consumes the React element tree at render time. No DOM or React runtime is used — only `React.createElement` via JSX transform. |

### Utilities

| Package | Purpose |
|---|---|
| `dotenv` | Loads `.env` into `process.env` for local development. In production (Vercel), environment variables are set in the dashboard and `dotenv` is a no-op. |

---

## Frontend (`lb-card-fe`)

### Framework

| Package | Purpose |
|---|---|
| `next` | React meta-framework. Provides file-based routing, server components, image optimisation, and the dev server. The frontend is a pure client component (`"use client"`) — no SSR data fetching. Auto-deploys on push to `main` via Vercel. |
| `react` / `react-dom` | Component model used throughout the frontend. All components are functional components with hooks. |
| `typescript` | Static typing for all frontend code. Shares no type definitions with the backend — types are duplicated by hand or kept minimal. |

### Styling

| Package | Purpose |
|---|---|
| `tailwindcss` | Utility-first CSS framework. All design tokens (colors, radii, font families) are defined as CSS custom properties in `globals.css` and bridged into Tailwind via `tailwind.config.ts` — e.g. `colors: { accent: 'var(--accent)' }` generates `text-accent`, `bg-accent`, etc. Eliminates inline `style={{}}` props from components. |
| `postcss` | Required by Tailwind's build pipeline. Processes CSS at build time. |
| `autoprefixer` | PostCSS plugin that adds vendor prefixes to CSS output for cross-browser compatibility. |

---

## Deployment Infrastructure

| Tool | Purpose |
|---|---|
| **Vercel** | Hosts both repos. The backend deploys as a Node.js serverless function (`@vercel/node`) via `api/index.ts`. The frontend deploys as a standard Next.js app. Both auto-deploy on push to `main`. |
| **GitHub** | Source of truth for both repos. Vercel watches the `main` branch for deployments. |

---

## Development Tools

| Tool | Purpose |
|---|---|
| `eslint` | Lints TypeScript/TSX files. Configured to catch unused variables, unsafe `any` types, and common React mistakes. |
| `prettier` (implicit) | Code formatting is consistent across files — enforced by editor config or CI. |

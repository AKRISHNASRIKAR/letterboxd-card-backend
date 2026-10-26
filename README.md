<p align="center">
  <img src="https://letterboxd-card-backend.vercel.app/api/card?user=akrishnasrikar&theme=default&width=480&count=4" alt="Letterboxd Card" width="550" />
</p>

<h1 align="center">Letterboxd Card</h1>

<p align="center">
  <strong>Generate beautiful, embeddable stat cards for any Letterboxd profile.</strong>
</p>

<p align="center">
  <a href="https://letterboxd-card.vercel.app">Live Demo</a> &middot;
  <a href="#api-reference">API Docs</a> &middot;
  <a href="#self-hosting">Self-Host</a> &middot;
  <a href="#documentation">Architecture Docs</a> &middot;
  <a href="https://github.com/AKRISHNASRIKAR/letterboxd-card-backend/issues">Report Bug</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/letterboxd-%2300e054?style=flat&logo=letterboxd&logoColor=white" alt="Letterboxd" />
  <img src="https://img.shields.io/badge/deployed%20on-vercel-%23000?style=flat&logo=vercel" alt="Vercel" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
</p>

---

## What is this?

A backend API that generates **SVG stat cards** for any public Letterboxd user. Drop the image URL into your GitHub README, Notion page, blog, or anywhere that supports images.

The card shows your **avatar**, **all-time stats** (films, this year, lists, following, followers), and your **4 most recent watches** with real poster art — all rendered server-side as a crisp SVG.

### Quick Start

Just paste this into your GitHub README (replace `your-username`):

```md
![Letterboxd Stats](https://letterboxd-card-backend.vercel.app/api/card?user=your-username)
```

Or in HTML:

```html
<img src="https://letterboxd-card-backend.vercel.app/api/card?user=your-username" alt="My Letterboxd Stats" width="550" />
```

---

## API Reference

### `GET /api/card`

Returns an **SVG image** of the user's Letterboxd stat card.

| Parameter | Type     | Default   | Description                          |
|-----------|----------|-----------|--------------------------------------|
| `user`    | `string` | required  | Letterboxd username                  |
| `theme`   | `string` | `default` | Card theme: `default`, `dark`, `minimal` |
| `width`   | `number` | `480`     | Card width in pixels (300-800)       |
| `count`   | `number` | `4`       | Number of recent film posters (1-8)  |

**Example:**

```
https://letterboxd-card-backend.vercel.app/api/card?user=dave&theme=dark&count=4
```

### `GET /api/stats`

Returns **JSON** with the user's full profile stats.

| Parameter | Type     | Description         |
|-----------|----------|---------------------|
| `user`    | `string` | Letterboxd username |

**Response:**

```json
{
  "data": {
    "username": "dave",
    "displayName": "Dave",
    "avatar": "https://a.ltrbxd.com/resized/avatar/...",
    "stats": {
      "totalFilms": 2460,
      "thisYear": 23,
      "following": 9,
      "followers": 15,
      "lists": 11
    },
    "recentFilms": [
      {
        "slug": "the-batman",
        "name": "The Batman",
        "rating": "",
        "year": "2022",
        "posterUrl": "https://a.ltrbxd.com/resized/film-poster/..."
      }
    ],
    "fetchedAt": 1775650944175
  },
  "cached": true
}
```

### `GET /api/films`

Returns a JSON array of the user's recently logged films.

| Parameter | Type     | Default | Description                 |
|-----------|----------|---------|-----------------------------|
| `user`    | `string` | required| Letterboxd username         |
| `count`   | `number` | `8`     | Number of films (1-20)      |

### `GET /api/lists`

Returns a JSON array of the user's public lists.

| Parameter | Type     | Description         |
|-----------|----------|---------------------|
| `user`    | `string` | Letterboxd username |

---

## How It Works

```
Browser / README
       |
       |  GET /api/card?user=akrishnasrikar
       v
  ┌─────────────────────────────────┐
  │         Express Server          │
  │  validate -> cache -> render    │
  └──────────┬──────────────────────┘
             |
    ┌────────┴────────┐
    |  Redis Cache?   |
    |  (Upstash, 1hr) |
    └────────┬────────┘
             | miss
             v
  ┌─────────────────────────────────┐
  │    Scrape letterboxd.com        │
  │  (cheerio, throttled, retried)  │
  └──────────┬──────────────────────┘
             |
             v
  ┌─────────────────────────────────┐
  │    Parse HTML with selectors    │
  │  stats, avatar, recent films    │
  └──────────┬──────────────────────┘
             |
             v
  ┌─────────────────────────────────┐
  │  Fetch posters + avatar as b64  │
  │       (parallel Promise.all)    │
  └──────────┬──────────────────────┘
             |
             v
  ┌─────────────────────────────────┐
  │   Render SVG card with Satori   │
  │   (React JSX -> SVG string)     │
  └──────────┬──────────────────────┘
             |
             v
      image/svg+xml response
```

### Where the stats come from

Letterboxd sits behind Cloudflare, and a subset of member paths — the profile
root `/<user>/`, anything under `/for/<year>/`, and `/page/<n>/` — is served a bot
challenge to any client whose TLS handshake isn't a real browser's. No
combination of request headers gets Node past it, so the profile page, which used
to supply every figure in one request, is not a dependency any more. Each
statistic is taken from a member sub-page that still answers:

| Field                             | Source              |
|-----------------------------------|---------------------|
| display name, avatar, total films | `/<user>/films/`    |
| following **and** followers       | `/<user>/followers/`|
| lists                             | `/<user>/lists/`    |
| recent watches, films this year   | `/<user>/rss/`      |

The profile root is requested alongside these and supplies the exact "This year"
value when its link explicitly identifies the current UTC year. An explicit zero
is valid. Without that field, the backend counts distinct current-year film slugs
in the available RSS window and marks the result as a lower bound. RSS entries
can be published out of watched-date order, so seeing an older watched date does
not prove the feed contains the complete current-year history.

The API includes `thisYearInfo` with `year`, `accuracy` (`exact`, `lower_bound`, or
`unavailable`), and `source`. Both the SVG card and frontend show a `+` suffix for
a lower bound, and a dash when unavailable. Diary entry totals are not substituted
for the profile statistic: those measures must not be assumed interchangeable.
Statistics use `stats:v5:<UTC-year>:<username>` cache keys, preventing
previous-year reuse. Exact results are cached for one hour; incomplete or
unavailable counts are cached for 60 seconds so a successful profile request can
replace them promptly. Cache reads also check `fetchedAt`, so incomplete records
written with the old one-hour TTL are retried after a minute. Partial SVG responses
have a 60-second shared-cache lifetime and no day-long stale-serving window.
Deploy the backend and frontend changes together. Existing embedded SVGs can
remain cached by browsers/CDNs until their existing cache lifetime expires.

A challenge page is valid HTML, so it used to parse into a profile of all zeroes
that the API served as a `200`. `scraper.ts` now recognises one and the request
fails with a `502` instead — a zeroed card can only mean a genuinely empty
profile.

**Tech stack:**

- **[Express 5](https://expressjs.com/)** — API framework
- **[Cheerio](https://cheerio.js.org/)** — HTML parsing (scrapes Letterboxd profile pages)
- **[Satori](https://github.com/vercel/satori)** — Converts React JSX to SVG (no browser needed)
- **[Upstash Redis](https://upstash.com/)** — Serverless caching (1-hour TTL)
- **[TMDB API](https://developer.themoviedb.org/docs)** — Used to fetch high-resolution posters as a fallback for missing or low-quality Letterboxd images.
- **[Zod](https://zod.dev/)** — Request validation
- **[Vercel](https://vercel.com/)** — Hosting (serverless functions)

---

## Project Structure

```
lb-card-be/
├── api/
│   └── index.ts                    # Vercel serverless entry point
├── src/
│   ├── index.ts                    # Local dev entry (loads .env, starts server)
│   ├── server.ts                   # Express app (CORS, helmet, routes, error handler)
│   │
│   ├── routes/
│   │   ├── index.ts                # Mounts /card, /stats, /films, /lists
│   │   ├── card.route.ts
│   │   ├── stats.route.ts
│   │   ├── films.route.ts
│   │   └── lists.route.ts
│   │
│   ├── controllers/
│   │   ├── card.controller.ts      # Scrapes stats -> renders SVG -> returns image
│   │   ├── stats.controller.ts     # Scrapes stats -> returns JSON
│   │   ├── films.controller.ts     # Reads the RSS feed -> returns JSON
│   │   └── lists.controller.ts     # Scrapes /lists/ page -> returns JSON
│   │
│   ├── services/
│   │   ├── cache.service.ts        # Upstash Redis get/set/bust
│   │   ├── letterboxd/
│   │   │   ├── index.ts            # scrapeStats() — composes the sub-pages
│   │   │   ├── scraper.ts          # HTTP fetch + throttle, retry, bot-block detection
│   │   │   ├── selectors.ts        # CSS selectors for cheerio
│   │   │   ├── parser.ts           # HTML/RSS -> raw data extraction
│   │   │   └── transformer.ts      # Raw data -> typed LetterboxdStats
│   │   └── card/
│   │       ├── renderer.tsx        # React JSX + Satori -> SVG card
│   │       └── themes/
│   │           ├── index.ts        # Theme registry
│   │           ├── default.ts
│   │           ├── dark.ts
│   │           └── minimal.ts
│   │
│   ├── middleware/
│   │   ├── validate.ts             # Zod schema validation
│   │   ├── rateLimit.ts            # 30 req/min per IP
│   │   ├── cache.middleware.ts      # Redis cache check/store
│   │   └── errorHandler.ts         # 404/429/500 error mapping
│   │
│   ├── validators/
│   │   └── params.ts               # Zod schemas for all endpoints
│   │
│   └── types/
│       └── letterboxd.ts           # Film, LetterboxdStats, Theme, CardParams
│
├── vercel.json
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Documentation

For a deeper dive into the system design, check out the documentation:

- **[Architecture Overview](docs/overview.md)** — High-level design, scaling considerations, and API architecture.
- **[Workflow Flowchart](docs/flowchart/workflow.md)** — Visual representation of the request lifecycle and data pipeline.
- **[Libraries Reference](docs/libraries.md)** — Detailed list of dependencies and their roles in the project.

---

## Self-Hosting

### Prerequisites

- Node.js 18+
- An [Upstash Redis](https://upstash.com/) database (free tier works)
- A [Vercel](https://vercel.com/) account (or any Node.js host)

### 1. Clone & Install

```bash
git clone https://github.com/AKRISHNASRIKAR/letterboxd-card-backend.git
cd letterboxd-card-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
FRONTEND_URL=https://your-frontend.vercel.app
PORT=3001
TMDB_API_KEY=your-tmdb-api-key # Optional but recommended for fetching high-res posters
```

### 3. Run Locally

```bash
npm run dev
```

The API will be available at `http://localhost:3001/api/`.

Test it:

```bash
curl "http://localhost:3001/api/stats?user=dave"
```

### 4. Deploy to Vercel

```bash
npx vercel --prod
```

Set your environment variables in the Vercel dashboard under **Settings > Environment Variables**.

---

## Rate Limiting & Caching

| Layer | Limit | Purpose |
|-------|-------|---------|
| **Client rate limit** | 30 req/min per IP | Protects the API from abuse |
| **Redis cache** | 1 hour for exact stats; 60 seconds for incomplete stats | Avoids repeated scraping while retrying incomplete yearly totals promptly |
| **CDN cache** | `s-maxage=3600` | Vercel edge caches card images for 1 hour |
| **Upstream throttle** | 2 req/sec to Letterboxd | Prevents getting blocked by Letterboxd |
| **Retry logic** | 3 retries, exponential backoff | Handles transient Letterboxd failures |

---

## Frontend

The companion frontend lives in a separate repo and provides a web UI for generating cards:

**[letterboxd-card](https://github.com/AKRISHNASRIKAR/letterboxd-card)** — Next.js app at [letterboxd-card.vercel.app](https://letterboxd-card.vercel.app)

---

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for contributions

- Add more card themes
- Support for Letterboxd lists in the card
- RSS feed integration for more reliable data (Letterboxd provides RSS at `/{user}/rss/`)
- Dark/light mode auto-detection
- Animated SVG card transitions
- Weekly/monthly stats view

---

## License

[MIT](LICENSE) &copy; 2026 A Krishna Srikar

---

<p align="center">
  Built with Letterboxd data. Not affiliated with Letterboxd Ltd.
</p>

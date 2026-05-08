# Request Workflow

End-to-end flow from the moment a user submits their Letterboxd username.

```mermaid
flowchart TD
    A([User enters username\non lb-card-fe]) --> B[UserInput strips @\nand lowercases value]
    B --> C{Username submitted}

    C --> D[PreviewCard renders\n&lt;img src='/api/card?user=X'&gt;]
    C --> E[CopyableLink renders\nmarkdown / HTML / URL snippets]

    D --> F[Browser GETs\n/api/card?user=X]

    subgraph BE [lb-card-be — Express serverless on Vercel]
        F --> G[validate middleware\nZod schema on query.user]
        G --> H{Redis cache hit?\nstats:v3:username}

        H -- HIT --> I[Return cached LetterboxdStats]
        H -- MISS --> J[scraper.fetchProfile\nfetchFilms if needed]

        J --> K[p-throttle: max 2 req/s\np-retry: up to 3 attempts]
        K --> L[fetch letterboxd.com/username\nwith browser-like headers]
        L --> M[HTML response]

        M --> N[parser.parseProfile\nload HTML into Cheerio]

        N --> O[Extract profile fields\nusername · displayName\nmemberSince · avatar]
        N --> P[Extract recentFilms\nfrom #recent-activity\n.react-component each]

        P --> Q[Read data-postered-identifier\nJSON: uid = 'film:48113']
        Q --> R[filmId = '48113'\nfrom uid.replace /^film:/]

        O --> S[transformer.transform\nRaw → LetterboxdStats]
        R --> S

        S --> T[filmIdToPath\n'48113' → '4/8/1/1/3/48113']
        T --> U[posterUrl = a.ltrbxd.com/resized/\nfilm-poster/4/8/1/1/3/48113\n-slug-0-230-0-345-crop.jpg]

        U --> V[Cache result in Upstash Redis\nTTL = 3600s]
        V --> I

        I --> W[renderCard stats]

        subgraph RENDER [renderer.tsx — Satori pipeline]
            W --> X[loadFonts\nInter 400 + 700 from jsDelivr\nor Google Fonts fallback]
            W --> Y[toBase64 avatar URL\nfetch → ArrayBuffer → base64]
            W --> Z[toBase64 each posterUrl\nreject VP8L WebP\nreject &lt; 200 bytes]

            X --> AA[satori JSX → SVG string\n1100 × 340 px]
            Y --> AA
            Z --> AA
        end

        AA --> AB[Buffer.from SVG\nContent-Type: image/svg+xml]
    end

    AB --> D
    D --> AC([Card displayed in browser\nor embedded via &lt;img&gt; tag])
```

## Key decision points

### Cache hit vs miss
On a cache hit the scraper, parser, and transformer are all skipped. Only the renderer runs (font + image fetching still happens on every request since the SVG is not cached, only the stats JSON is).

### filmId extraction
Letterboxd renders its film grids entirely in JavaScript. The `img` tag in server-rendered HTML always points to the empty placeholder. The numeric film ID is available in `data-postered-identifier` without JavaScript execution:
```
data-postered-identifier = {"lid":"21aa","uid":"film:48113","type":"film"}
```
The parser reads this attribute and extracts `48113` from `uid`.

### VP8L rejection
Letterboxd's empty-poster placeholder is a 42-byte VP8L (lossless) WebP. Satorio's wasm image decoder only handles lossy VP8/VP8X and crashes on VP8L. The renderer detects VP8L by checking bytes 12–15 (`56 50 38 4c` = "VP8L") and returns `null`, which renders as a text-only placeholder div instead.

### Proxy fallback (scraper)
If the direct `fetch` to letterboxd.com fails after 3 retries, the scraper falls back to allorigins.win and then corsproxy.io as CORS proxy mirrors. This adds latency but improves reliability from Vercel's network.
```

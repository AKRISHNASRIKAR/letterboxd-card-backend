// src/services/card/renderer.tsx
import React from "react";
import satori from "satori";
import type { LetterboxdStats } from "../../types/letterboxd";

// Allow satori's `tw` prop on all HTML elements
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    tw?: string
  }
}

// ── Font cache ────────────────────────────────────────────────────────────────

let _font400: ArrayBuffer | null = null;
let _font700: ArrayBuffer | null = null;

const FONT_SOURCES = [
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest",
  "https://fonts.gstatic.com/s/inter/v13",
]

async function fetchFontBuf(filename: string): Promise<ArrayBuffer | null> {
  for (const base of FONT_SOURCES) {
    try {
      const r = await fetch(`${base}/${filename}`, { signal: AbortSignal.timeout(6000) })
      if (r.ok) return r.arrayBuffer()
    } catch {
      // try next source
    }
  }
  return null
}

async function loadFonts(): Promise<[ArrayBuffer | null, ArrayBuffer | null]> {
  return Promise.all([
    _font400
      ? Promise.resolve(_font400)
      : fetchFontBuf("latin-400-normal.ttf").then((b) => { if (b) _font400 = b; return b }),
    _font700
      ? Promise.resolve(_font700)
      : fetchFontBuf("latin-700-normal.ttf").then((b) => { if (b) _font700 = b; return b }),
  ])
}

// ── Image helpers ─────────────────────────────────────────────────────────────

const IMAGE_USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
];

async function toBase64(url: string): Promise<string | null> {
  try {
    if (!url || !url.startsWith("http")) return null;

    const ua =
      IMAGE_USER_AGENTS[Math.floor(Math.random() * IMAGE_USER_AGENTS.length)];

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Referer: "https://letterboxd.com/",
        Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
        "User-Agent": ua,
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
      },
    });

    if (!res.ok) return null;

    // Strip content-type parameters (e.g. "; charset=utf-8") — satori needs a bare MIME type
    const rawMime = res.headers.get("content-type") || "image/jpeg"
    const mime = rawMime.split(";")[0].trim()
    if (!mime.startsWith("image/")) return null

    const buf = await res.arrayBuffer();
    // Images under 200 bytes are degenerate placeholders (e.g. 42-byte VP8L WebP
    // from Letterboxd empty-poster) that crash satori's internal image decoder.
    if (buf.byteLength < 200) return null

    // Reject VP8L (lossless) WebP — satori's wasm decoder handles only lossy VP8/VP8X.
    if (mime === "image/webp") {
      const h = new Uint8Array(buf)
      if (h.length >= 16 && h[12] === 0x56 && h[13] === 0x50 && h[14] === 0x38 && h[15] === 0x4c) {
        return null // VP8L
      }
    }

    const b64 = Buffer.from(buf).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

// ── TMDB poster fallback ──────────────────────────────────────────────────────
// Used when the Letterboxd CDN returns 403 (hotlink protection) for a film poster.
// Requires TMDB_API_KEY env variable. Gracefully degrades (returns null) if unset.

const TMDB_API_KEY = process.env.TMDB_API_KEY ?? ""

async function fetchTmdbPoster(name: string, year: string): Promise<string | null> {
  if (!TMDB_API_KEY || !name) return null
  try {
    const query = encodeURIComponent(name)
    const yearParam = year ? `&primary_release_year=${year}` : ""
    const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${query}${yearParam}&language=en-US&page=1`

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) return null

    const json = await res.json() as { results?: Array<{ poster_path?: string | null }> }
    const posterPath = json.results?.[0]?.poster_path
    if (!posterPath) return null

    // w342 is a good balance of quality vs. size for the 105×158px slot
    const imgUrl = `https://image.tmdb.org/t/p/w342${posterPath}`
    return toBase64(imgUrl)
  } catch {
    return null
  }
}

// Resolves a poster for one film: tries Letterboxd CDN first, falls back to TMDB.
async function resolvePoster(posterUrl: string, name: string, year: string): Promise<string | null> {
  const lbResult = await toBase64(posterUrl)
  if (lbResult) return lbResult
  return fetchTmdbPoster(name, year)
}

function timeAgo(ts: number): string {
  const d = Math.max(0, Date.now() - ts);
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Brand colours ─────────────────────────────────────────────────────────────

const C = {
  bg: "#14181c",
  surface: "#1c2228",
  text: "#cdd5db",
  muted: "#99aabb",
  dim: "#667788",
  green: "#00e054",
  border: "rgba(255,255,255,0.08)",
  orange: "#ff8000",
  blue: "#40bcf4",
} as const;

// ── Layout ────────────────────────────────────────────────────────────────────
//
//  1100 × 340 card
//  ┌──────────┬──────────────────────┬─────────────────────┐
//  │  USER    │    ALL-TIME STATS    │   RECENT WATCHES    │
//  │  170px   │      430px           │   flex:1 (~450px)   │
//  ├──────────┴──────────────────────┴─────────────────────┤
//  │  ● ● ●  letterboxd-card.vercel.app    Updated 4m ago  │
//  └───────────────────────────────────────────────────────┘

const W = 1100;
const H = 340;
const BOTTOM_BAR_H = 26;
const POSTER_W = 105;
const POSTER_H = 158;
const POSTER_COUNT = 4;
const POSTER_GAP = 6;

// Stats section constants
const STATS_W = 415; // balanced width to leave clean space for 4 posters without clipping

// Full stat labels
const STAT_LABELS: Record<string, string> = {
  FILMS:     "FILMS",
  THIS_YEAR: "THIS YEAR",
  LISTS:     "LISTS",
  FOLLOWING: "FOLLOWING",
  FOLLOWERS: "FOLLOWERS",
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderCard(
  stats: LetterboxdStats,
  count = 4,
): Promise<Buffer> {
  const films = stats.recentFilms.slice(0, Math.min(count, POSTER_COUNT));

  const [[font400, font700], avatarSrc, ...posterSrcs] = await Promise.all([
    loadFonts(),
    toBase64(stats.avatar),
    ...films.map((f) => resolvePoster(f.posterUrl, f.name, f.year)),
  ]);

  const fonts: Parameters<typeof satori>[1]["fonts"] = [
    ...(font400 ? [{ name: "Inter", data: font400, weight: 400 as const, style: "normal" as const }] : []),
    ...(font700 ? [{ name: "Inter", data: font700, weight: 700 as const, style: "normal" as const }] : []),
  ]

  if (fonts.length === 0) {
    throw new Error("Font loading failed: could not fetch Inter from any CDN source")
  }

  const statItems = [
    { label: STAT_LABELS.FILMS,     value: stats.stats.totalFilms },
    { label: STAT_LABELS.THIS_YEAR, value: stats.stats.thisYear   },
    { label: STAT_LABELS.LISTS,     value: stats.stats.lists      },
    { label: STAT_LABELS.FOLLOWING, value: stats.stats.following  },
    { label: STAT_LABELS.FOLLOWERS, value: stats.stats.followers  },
  ];

  try {
    const svg = await satori(
      <div
        tw="flex flex-col w-full h-full"
        style={{ background: C.bg, fontFamily: "Inter, sans-serif" }}
      >
        {/* ── MAIN ROW ─────────────────────────────────────────────── */}
        <div
          tw="flex flex-1 items-center overflow-hidden"
          style={{ padding: "22px 24px 18px 24px" }}
        >
          {/* ── USER (170px) ───────────────────────────────────────── */}
          <div
            tw="flex flex-col items-center justify-center"
            style={{ width: 170, minWidth: 170, paddingRight: 22, borderRight: `1px solid ${C.border}` }}
          >
            {avatarSrc ? (
              <img src={avatarSrc} width={68} height={68} style={{ borderRadius: "50%" }} />
            ) : (
              <div
                tw="flex items-center justify-center"
                style={{ width: 68, height: 68, borderRadius: "50%", background: C.surface, fontSize: 26, fontWeight: 700, color: C.green }}
              >
                {(stats.displayName || stats.username || "?")[0].toUpperCase()}
              </div>
            )}
            <div
              tw="flex"
              style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: C.text }}
            >
              {stats.displayName || stats.username}
            </div>
            {stats.displayName && stats.displayName.toLowerCase() !== stats.username.toLowerCase() && (
              <div tw="flex" style={{ marginTop: 3, fontSize: 12, color: C.muted }}>
                @{stats.username}
              </div>
            )}
          </div>

          {/* ── STATS (430px) ──────────────────────────────────────── */}
          <div
            tw="flex flex-col justify-center"
            style={{ width: STATS_W, minWidth: STATS_W, borderRight: `1px solid ${C.border}` }}
          >
            {/* Section label */}
            <div
              tw="flex uppercase"
              style={{ fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 18, paddingLeft: 24 }}
            >
              All-time stats
            </div>

            {/* Stat columns — fixed 82.2px column widths ensure even spacing and alignment across all digits and labels. */}
            <div tw="flex items-center justify-between w-full">
              {statItems.flatMap((s, i) => [
                i > 0 ? (
                  <div
                    key={`sep-${s.label}`}
                    tw="flex"
                    style={{ width: 1, height: 30, background: C.border, flexShrink: 0 }}
                  />
                ) : null,
                <div
                  key={s.label}
                  tw="flex flex-col items-center justify-center"
                  style={{ width: 82.2, minWidth: 82.2, overflow: "hidden" }}
                >
                  <span
                    style={{
                      fontSize:   s.value >= 100000 ? 18 : 22,
                      fontWeight: 700,
                      color:      C.green,
                      lineHeight: 1,
                    }}
                  >
                    {s.value.toLocaleString()}
                  </span>
                  <span
                    tw="uppercase"
                    style={{
                      fontSize:      7.5,
                      color:         C.dim,
                      letterSpacing: "0.05em",
                      marginTop:     8,
                      textAlign:     "center",
                      lineHeight:    1,
                      whiteSpace:    "nowrap",
                    }}
                  >
                    {s.label}
                  </span>
                </div>,
              ]).filter(Boolean)}
            </div>
          </div>

          {/* ── POSTERS (flex:1) ───────────────────────────────────── */}
          <div tw="flex flex-col flex-1 overflow-hidden" style={{ paddingLeft: 24 }}>
            {/* Section label */}
            <div
              tw="flex uppercase"
              style={{ fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 10 }}
            >
              Recent watches
            </div>

            {/* Poster row */}
            <div tw="flex items-center" style={{ gap: POSTER_GAP }}>
              {films.length > 0 ? (
                films.map((film, i) => {
                  const src = posterSrcs[i];
                  return src ? (
                    <img
                      key={film.slug}
                      src={src}
                      width={POSTER_W}
                      height={POSTER_H}
                      style={{ borderRadius: 5, flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      key={film.slug}
                      tw="flex items-center justify-center"
                      style={{ flexShrink: 0, width: POSTER_W, height: POSTER_H, background: C.surface, borderRadius: 5, padding: 6, fontSize: 9, color: C.dim, overflow: "hidden" }}
                    >
                      {film.name}
                    </div>
                  );
                })
              ) : (
                <div tw="flex" style={{ fontSize: 11, color: C.dim }}>No recent activity</div>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ───────────────────────────────────────────── */}
        <div
          tw="flex items-center justify-between"
          style={{ height: BOTTOM_BAR_H, minHeight: BOTTOM_BAR_H, background: C.surface, padding: "0 16px", borderTop: `1px solid ${C.border}` }}
        >
          <div tw="flex items-center" style={{ gap: 5 }}>
            <div tw="flex" style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange }} />
            <div tw="flex" style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
            <div tw="flex" style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue }} />
            <span style={{ fontSize: 10, color: C.dim, marginLeft: 5 }}>letterboxd-card.vercel.app</span>
          </div>
          <span style={{ fontSize: 10, color: C.dim }}>Updated {timeAgo(stats.fetchedAt)}</span>
        </div>
      </div>,
      { width: W, height: H, fonts },
    );

    return Buffer.from(svg, "utf-8");
  } catch (err) {
    console.error("Failed to render card with satori:", err);
    throw err;
  }
}

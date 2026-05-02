// src/services/card/renderer.tsx
import React from "react";
import satori from "satori";
import type { LetterboxdStats } from "../../types/letterboxd";

// ── Font cache ────────────────────────────────────────────────────────────────

let _font400: ArrayBuffer | null = null;
let _font700: ArrayBuffer | null = null;

async function loadFonts(): Promise<[ArrayBuffer | null, ArrayBuffer | null]> {
  const BASE = "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest";
  return Promise.all([
    _font400
      ? Promise.resolve(_font400)
      : fetch(`${BASE}/latin-400-normal.ttf`)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => { if (b) _font400 = b; return b; })
          .catch(() => null),
    _font700
      ? Promise.resolve(_font700)
      : fetch(`${BASE}/latin-700-normal.ttf`)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => { if (b) _font700 = b; return b; })
          .catch(() => null),
  ]);
}

// ── Image helpers ─────────────────────────────────────────────────────────────

async function toBase64(url: string): Promise<string | null> {
  try {
    if (!url) return null;
    const res = await fetch(url, {
      headers: {
        "Referer": "https://letterboxd.com",
        "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const buf  = await res.arrayBuffer();
    const b64  = Buffer.from(buf).toString("base64");
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function timeAgo(ts: number): string {
  const d = Math.max(0, Date.now() - ts);
  const m = Math.floor(d / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Brand colours ─────────────────────────────────────────────────────────────

const C = {
  bg:      "#14181c",
  surface: "#1c2228",
  text:    "#cdd5db",
  muted:   "#99aabb",
  dim:     "#667788",
  green:   "#00e054",
  border:  "rgba(255,255,255,0.08)",
  orange:  "#ff8000",
  blue:    "#40bcf4",
} as const;

// ── Layout ────────────────────────────────────────────────────────────────────
//
//  1100 × 340 card
//  ┌──────────┬─────────────────────┬──────────────────────┐
//  │  USER    │    ALL-TIME STATS   │   RECENT WATCHES     │
//  │  170px   │      400px          │   flex:1 (~480px)    │
//  ├──────────┴─────────────────────┴──────────────────────┤
//  │  ● ● ●  letterboxd-card.vercel.app    Updated 4m ago  │
//  └───────────────────────────────────────────────────────┘

const W            = 1100;
const H            = 340;
const BOTTOM_BAR_H = 26;
const POSTER_W     = 105;
const POSTER_H     = 158;
const POSTER_COUNT = 4;
const POSTER_GAP   = 6;

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderCard(
  stats: LetterboxdStats,
  count = 4,
): Promise<Buffer> {
  const films = stats.recentFilms.slice(0, Math.min(count, POSTER_COUNT));

  const [[font400, font700], avatarSrc, ...posterSrcs] = await Promise.all([
    loadFonts(),
    toBase64(stats.avatar),
    ...films.map((f) => toBase64(f.posterUrl)),
  ]);

  const fonts: Parameters<typeof satori>[1]["fonts"] = [
    ...(font400 ? [{ name: "Inter", data: font400, weight: 400 as const, style: "normal" as const }] : []),
    ...(font700 ? [{ name: "Inter", data: font700, weight: 700 as const, style: "normal" as const }] : []),
  ];

  const statItems = [
    { label: "FILMS",     value: stats.stats.totalFilms },
    { label: "THIS YEAR", value: stats.stats.thisYear   },
    { label: "LISTS",     value: stats.stats.lists      },
    { label: "FOLLOWING", value: stats.stats.following  },
    { label: "FOLLOWERS", value: stats.stats.followers  },
  ];

  try {
    const svg = await satori(
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.bg, fontFamily: "Inter, sans-serif" }}>

        {/* ── MAIN ROW ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "22px 24px 18px 24px", overflow: "hidden" }}>

          {/* ── USER (170px) ───────────────────────────────────────── */}
          <div
            style={{
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              width:           170,
              minWidth:        170,
              paddingRight:    22,
              borderRight:    `1px solid ${C.border}`,
            }}
          >
            {avatarSrc ? (
              <img src={avatarSrc} width={68} height={68} style={{ borderRadius: "50%" }} />
            ) : (
              <div style={{ display: "flex", width: 68, height: 68, borderRadius: "50%", background: C.surface, alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: C.green }}>
                {(stats.displayName || stats.username || "?")[0].toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", marginTop: 12, fontSize: 17, fontWeight: 700, color: C.text }}>
              {stats.displayName || stats.username}
            </div>
            {stats.displayName && stats.displayName.toLowerCase() !== stats.username.toLowerCase() && (
              <div style={{ display: "flex", marginTop: 3, fontSize: 12, color: C.muted }}>
                @{stats.username}
              </div>
            )}
          </div>

          {/* ── STATS (400px) ──────────────────────────────────────── */}
          <div
            style={{
              display:        "flex",
              flexDirection:  "column",
              justifyContent: "center",
              width:           400,
              minWidth:        400,
              padding:         "0 28px",
              borderRight:    `1px solid ${C.border}`,
            }}
          >
            {/* Section label */}
            <div style={{ display: "flex", fontSize: 9, color: C.dim, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 18 }}>
              All-time stats
            </div>

            {/* Stat columns */}
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              {statItems.flatMap((s, i) => [
                i > 0 ? (
                  <div key={`border-${s.label}`} style={{ display: "flex", width: 1, height: 32, background: C.border }} />
                ) : null,
                <div
                  key={s.label}
                  style={{
                    display:       "flex",
                    flexDirection: "column",
                    alignItems:    "center",
                    flex:           1,
                  }}
                >
                  <span style={{ fontSize: 24, fontWeight: 700, color: C.green, lineHeight: 1 }}>
                    {s.value.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 8, color: C.dim, letterSpacing: "0.1em", marginTop: 8, textTransform: "uppercase" }}>
                    {s.label}
                  </span>
                </div>
              ])}
            </div>
          </div>

          {/* ── POSTERS (flex:1) ───────────────────────────────────── */}
          <div
            style={{
              display:        "flex",
              flexDirection:  "column",
              flex:            1,
              paddingLeft:     24,
              overflow:       "hidden",
            }}
          >
            {/* Section label */}
            <div style={{ display: "flex", fontSize: 9, color: C.dim, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
              Recent watches
            </div>

            {/* Poster row */}
            <div style={{ display: "flex", alignItems: "center", gap: POSTER_GAP }}>
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
                      style={{
                        display:        "flex",
                        flexShrink:      0,
                        width:           POSTER_W,
                        height:          POSTER_H,
                        background:      C.surface,
                        borderRadius:    5,
                        alignItems:     "center",
                        justifyContent: "center",
                        padding:         6,
                        fontSize:        9,
                        color:           C.dim,
                        overflow:       "hidden",
                      }}
                    >
                      {film.name}
                    </div>
                  );
                })
              ) : (
                <div style={{ display: "flex", fontSize: 11, color: C.dim }}>
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ───────────────────────────────────────────── */}
        <div
          style={{
            display:        "flex",
            height:          BOTTOM_BAR_H,
            minHeight:       BOTTOM_BAR_H,
            background:      C.surface,
            alignItems:     "center",
            justifyContent: "space-between",
            padding:         "0 16px",
            borderTop:      `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ display: "flex", width: 7, height: 7, borderRadius: "50%", background: C.orange }} />
            <div style={{ display: "flex", width: 7, height: 7, borderRadius: "50%", background: C.green  }} />
            <div style={{ display: "flex", width: 7, height: 7, borderRadius: "50%", background: C.blue   }} />
            <span style={{ fontSize: 10, color: C.dim, marginLeft: 5 }}>
              letterboxd-card.vercel.app
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.dim }}>
            Updated {timeAgo(stats.fetchedAt)}
          </span>
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

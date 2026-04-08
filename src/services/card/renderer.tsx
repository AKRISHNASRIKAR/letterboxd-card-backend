// src/services/card/renderer.tsx
// Uses satori directly (SVG) — no WASM, works reliably on @vercel/node
import React from "react";
import satori from "satori";
import type { LetterboxdStats, CardParams } from "../../types/letterboxd";

// ── Font (cached after first cold-start fetch) ───────────────────────────────

let _fontCache: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer | null> {
  if (_fontCache) return _fontCache;
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
    );
    if (!res.ok) return null;
    _fontCache = await res.arrayBuffer();
    return _fontCache;
  } catch {
    return null;
  }
}

// ── Image helpers ─────────────────────────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

// ── Card dimensions ───────────────────────────────────────────────────────────

const W = 800;
const H = 240;

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderCard(
  stats: LetterboxdStats,
  _params: CardParams,
): Promise<Buffer> {
  // Pre-fetch all images and font in parallel
  const films = stats.recentFilms.slice(0, 8);
  const [fontData, avatarData, ...posterData] = await Promise.all([
    loadFont(),
    fetchImageAsBase64(stats.avatar),
    ...films.map((f) => fetchImageAsBase64(f.posterUrl)),
  ]);

  const fonts: Parameters<typeof satori>[1]["fonts"] = fontData
    ? [{ name: "Inter", data: fontData, weight: 400, style: "normal" as const }]
    : [];

  const statItems = [
    { label: "FILMS",     value: stats.stats.totalFilms },
    { label: "THIS YEAR", value: stats.stats.thisYear   },
    { label: "LISTS",     value: stats.stats.lists      },
    { label: "FOLLOWING", value: stats.stats.following  },
    { label: "FOLLOWERS", value: stats.stats.followers  },
  ];

  const POSTER_H = 160;
  const POSTER_W = Math.round(POSTER_H * (2 / 3)); // ~107px

  const svg = await satori(
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        width:         "100%",
        height:        "100%",
        background:    C.bg,
        fontFamily:    "Inter, sans-serif",
      }}
    >
      {/* ── Main row ── */}
      <div style={{ display: "flex", flex: 1, padding: "20px 20px 12px 20px" }}>

        {/* Left: User */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            width:          150,
            minWidth:       150,
            paddingRight:   18,
            borderRight:    `1px solid ${C.border}`,
          }}
        >
          {avatarData ? (
            <img
              src={avatarData}
              width={56}
              height={56}
              style={{ borderRadius: "50%" }}
            />
          ) : (
            <div
              style={{
                display:        "flex",
                width:          56,
                height:         56,
                borderRadius:   "50%",
                background:     C.surface,
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       22,
                fontWeight:     700,
                color:          C.green,
              }}
            >
              {(stats.displayName || stats.username || "?")[0].toUpperCase()}
            </div>
          )}

          <div
            style={{
              display:    "flex",
              marginTop:  8,
              fontSize:   15,
              fontWeight: 700,
              color:      C.text,
            }}
          >
            {stats.displayName || stats.username}
          </div>

          {stats.displayName &&
            stats.displayName.toLowerCase() !== stats.username.toLowerCase() && (
              <div style={{ display: "flex", marginTop: 2, fontSize: 11, color: C.muted }}>
                @{stats.username}
              </div>
            )}
        </div>

        {/* Middle: Stats */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            padding:        "0 18px",
            borderRight:    `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex" }}>
            {statItems.map((s, i) => (
              <div
                key={s.label}
                style={{
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                  paddingLeft:   i > 0 ? 14 : 0,
                  paddingRight:  i < statItems.length - 1 ? 14 : 0,
                  borderLeft:    i > 0 ? `1px solid ${C.border}` : "none",
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 700, color: C.green, lineHeight: 1 }}>
                  {s.value.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize:      8,
                    color:         C.dim,
                    letterSpacing: "0.12em",
                    marginTop:     6,
                    textTransform: "uppercase",
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Posters */}
        <div
          style={{
            display:        "flex",
            flex:           1,
            alignItems:     "center",
            justifyContent: "flex-end",
            paddingLeft:    14,
            gap:            4,
          }}
        >
          {films.map((film, i) => {
            const src = posterData[i];
            return src ? (
              <img
                key={film.slug}
                src={src}
                width={POSTER_W}
                height={POSTER_H}
                style={{ borderRadius: 4 }}
              />
            ) : (
              <div
                key={film.slug}
                style={{
                  display:        "flex",
                  width:          POSTER_W,
                  height:         POSTER_H,
                  background:     C.surface,
                  borderRadius:   4,
                  alignItems:     "flex-end",
                  justifyContent: "center",
                  padding:        6,
                  fontSize:       8,
                  color:          C.dim,
                  overflow:       "hidden",
                }}
              >
                {film.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        style={{
          display:         "flex",
          height:          20,
          minHeight:       20,
          background:      C.surface,
          alignItems:      "center",
          justifyContent:  "space-between",
          padding:         "0 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ display: "flex", width: 6, height: 6, borderRadius: "50%", background: C.orange }} />
          <div style={{ display: "flex", width: 6, height: 6, borderRadius: "50%", background: C.green }} />
          <div style={{ display: "flex", width: 6, height: 6, borderRadius: "50%", background: C.blue }} />
          <span style={{ fontSize: 9, color: C.dim, marginLeft: 4 }}>
            letterboxd-card.vercel.app
          </span>
        </div>
        <span style={{ fontSize: 9, color: C.dim }}>
          Updated {timeAgo(stats.fetchedAt)}
        </span>
      </div>
    </div>,
    { width: W, height: H, fonts },
  );

  return Buffer.from(svg, "utf-8");
}

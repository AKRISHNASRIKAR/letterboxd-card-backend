// src/services/card/renderer.tsx
import React from "react";
import type { LetterboxdStats, CardParams } from "../../types/letterboxd";

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Brand colours ────────────────────────────────────────────────────────────

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

// ── Main render ──────────────────────────────────────────────────────────────

export async function renderCard(
  stats: LetterboxdStats,
  params: CardParams,
): Promise<Buffer> {
  const { ImageResponse } = await import("@vercel/og");

  const W = 800;
  const H = 240;

  // Fetch avatar + all poster images in parallel
  const films = stats.recentFilms.slice(0, 8);
  const [avatarData, ...posterData] = await Promise.all([
    fetchImageAsBase64(stats.avatar),
    ...films.map((f) => fetchImageAsBase64(f.posterUrl)),
  ]);

  // Stat items
  const statItems = [
    { label: "FILMS",     value: stats.stats.totalFilms },
    { label: "THIS YEAR", value: stats.stats.thisYear },
    { label: "LISTS",     value: stats.stats.lists },
    { label: "FOLLOWING", value: stats.stats.following },
    { label: "FOLLOWERS", value: stats.stats.followers },
  ];

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: C.bg,
          fontFamily: "sans-serif",
        }}
      >
        {/* ── Main content row ────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "20px 24px 12px 24px",
          }}
        >
          {/* ── Left: User section ──────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 160,
              minWidth: 160,
              paddingRight: 20,
              borderRight: `1px solid ${C.border}`,
            }}
          >
            {/* Avatar */}
            {avatarData ? (
              <img
                src={avatarData}
                width={56}
                height={56}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: C.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                {(stats.displayName || stats.username || "?")[0].toUpperCase()}
              </div>
            )}

            {/* Display name */}
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {stats.displayName || stats.username}
            </div>

            {/* Username (if different from display name) */}
            {stats.displayName &&
              stats.displayName.toLowerCase() !==
                stats.username.toLowerCase() && (
                <div
                  style={{
                    display: "flex",
                    marginTop: 2,
                    fontSize: 11,
                    color: C.muted,
                  }}
                >
                  @{stats.username}
                </div>
              )}
          </div>

          {/* ── Middle: Stats section ───────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingLeft: 20,
              paddingRight: 20,
              borderRight: `1px solid ${C.border}`,
            }}
          >
            <div style={{ display: "flex" }}>
              {statItems.map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingLeft: i > 0 ? 14 : 0,
                    paddingRight: i < statItems.length - 1 ? 14 : 0,
                    borderLeft:
                      i > 0 ? `1px solid ${C.border}` : "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: C.green,
                      lineHeight: 1,
                    }}
                  >
                    {s.value.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      letterSpacing: "0.12em",
                      marginTop: 6,
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Film posters ─────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-end",
              paddingLeft: 16,
              gap: 4,
            }}
          >
            {films.map((film, i) => {
              const posterSrc = posterData[i];
              const posterH = 160;
              const posterW = Math.round(posterH * (2 / 3));
              return posterSrc ? (
                <img
                  key={film.slug}
                  src={posterSrc}
                  width={posterW}
                  height={posterH}
                  style={{
                    borderRadius: 4,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  key={film.slug}
                  style={{
                    display: "flex",
                    width: posterW,
                    height: posterH,
                    background: C.surface,
                    borderRadius: 4,
                    alignItems: "flex-end",
                    justifyContent: "center",
                    padding: 6,
                    fontSize: 8,
                    color: C.dim,
                    overflow: "hidden",
                  }}
                >
                  {film.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            height: 20,
            minHeight: 20,
            width: "100%",
            background: C.surface,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
          }}
        >
          {/* Left: dots + site name */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.orange,
              }}
            />
            <div
              style={{
                display: "flex",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.green,
              }}
            />
            <div
              style={{
                display: "flex",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.blue,
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: C.dim,
                fontFamily: "monospace",
                marginLeft: 4,
              }}
            >
              letterboxd-card.vercel.app
            </span>
          </div>

          {/* Right: updated time */}
          <span
            style={{
              fontSize: 9,
              color: C.dim,
              fontFamily: "monospace",
            }}
          >
            Updated {timeAgo(stats.fetchedAt)}
          </span>
        </div>
      </div>
    ),
    { width: W, height: H },
  );

  const buf = await response.arrayBuffer();
  return Buffer.from(buf);
}

// src/services/card/renderer.tsx
import React from "react";
import { getTheme } from "./themes";
import type { LetterboxdStats, CardParams } from "../../types/letterboxd";

export async function renderCard(
  stats: LetterboxdStats,
  params: CardParams,
): Promise<Buffer> {
  // Dynamic import so ESM-only @vercel/og can be loaded from a CJS module
  const { ImageResponse } = await import("@vercel/og");

  const t = getTheme(params.theme);
  const w = params.width;
  const h = Math.round(w * 0.5); // 2:1 ratio

  const response = new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: t.background,
        padding: "24px",
        fontFamily: "sans-serif",
        border: `1px solid ${t.border}`,
        borderRadius: "12px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
          {stats.displayName}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: t.muted }}>
          LETTERBOXD
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
        {[
          { label: "Films",     value: stats.stats.totalFilms },
          { label: "This year", value: stats.stats.thisYear   },
          { label: "Lists",     value: stats.stats.lists      },
          { label: "Following", value: stats.stats.following  },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: t.accent }}>
              {s.value.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: t.muted, textTransform: "uppercase" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Film strip */}
      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        {stats.recentFilms.slice(0, params.count).map((film) => (
          <div
            key={film.slug}
            style={{
              display: "flex",
              flex: 1,
              background: t.filmTile,
              borderRadius: 6,
              alignItems: "flex-end",
              padding: 6,
              fontSize: 9,
              color: t.muted,
              overflow: "hidden",
            }}
          >
            {film.name}
          </div>
        ))}
      </div>
    </div>,
    { width: w, height: h },
  );

  const buf = await response.arrayBuffer();
  return Buffer.from(buf);
}

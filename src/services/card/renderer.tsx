// src/services/card/renderer.tsx
import React from "react";
import satori from "satori";
import { getTheme } from "./themes";
import type { LetterboxdStats, CardParams } from "../../types/letterboxd";

// Cache the font data so we only fetch once per cold start
let fontDataCache: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (fontDataCache) return fontDataCache;
  const res = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf"
  );
  fontDataCache = await res.arrayBuffer();
  return fontDataCache;
}

export async function renderCard(
  stats: LetterboxdStats,
  params: CardParams,
): Promise<string> {
  const fontData = await loadFont();
  const t = getTheme(params.theme);
  const w = params.width;
  const h = Math.round(w * 0.5); // 2:1 ratio

  const svg = await satori(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: t.background,
        padding: "24px",
        fontFamily: "Inter, sans-serif",
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
    {
      width: w,
      height: h,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 400,
          style: "normal" as const,
        },
      ],
    },
  );

  return svg;
}

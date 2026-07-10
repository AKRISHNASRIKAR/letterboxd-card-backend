import { renderCard } from "../services/card/renderer";
import type { LetterboxdStats } from "../types/letterboxd";

describe("renderCard integration test", () => {
  it("renders an SVG Buffer successfully from valid LetterboxdStats without throwing", async () => {
    const mockStats: LetterboxdStats = {
      username: "akrishnasrikar",
      displayName: "Krishna",
      memberSince: "Member since 2023",
      avatar: "https://a.ltrbxd.com/resized/avatar/upload/9/6/8/1/2/2/7/shard/avtr-0-220-0-220-crop.jpg?v=5bc292bee5",
      fetchedAt: Date.now(),
      stats: {
        totalFilms: 2487,
        thisYear: 36,
        following: 9,
        followers: 17,
        lists: 11,
      },
      recentFilms: [
        {
          slug: "project-hail-mary",
          name: "Project Hail Mary",
          rating: "★★★★★",
          year: "2026",
          posterUrl: "https://a.ltrbxd.com/resized/film-poster/6/1/1/2/8/8/611288-project-hail-mary-0-230-0-345-crop.jpg",
        },
      ],
    };

    const svgBuffer = await renderCard(mockStats, 1);
    expect(svgBuffer).toBeInstanceOf(Buffer);
    expect(svgBuffer.length).toBeGreaterThan(1000);
    const svgString = svgBuffer.toString("utf-8");
    expect(svgString).toContain("<svg");
  }, 30000);
});

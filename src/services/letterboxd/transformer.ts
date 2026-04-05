import type { LetterboxdStats } from "../../types/letterboxd"
import type { parseProfile }    from "./parser"
 
type Raw = ReturnType<typeof parseProfile>
 
function slugToPath(slug: string): string {
  // "hereditary" -> "h/e/r/e/hereditary"
  return `${slug[0]}/${slug[1]}/${slug[2]}/${slug[3]}/${slug}`
}
 
export function transform(raw: Raw): LetterboxdStats {;
  return {
    username:    raw.username,
    displayName: raw.displayName || raw.username,
    memberSince: raw.memberSince,
    avatar:      raw.avatar,
    stats: {
      totalFilms: raw.totalFilms,
      thisYear:   raw.thisYear,
      following:  raw.following,
      followers:  raw.followers,
      lists:      raw.lists,
    },
    recentFilms: raw.recentFilms.map(f => ({
      slug:      f.slug,
      name:      f.name,
      rating:    f.rating,
      year:      f.year,
      posterUrl: `https://a.ltrbxd.com/resized/film-poster/${slugToPath(f.slug)}-0-500-0-750-crop.jpg`,
    })),
    fetchedAt: Date.now(),
  }
}
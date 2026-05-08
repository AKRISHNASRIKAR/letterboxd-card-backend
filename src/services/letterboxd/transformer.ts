import type { LetterboxdStats } from "../../types/letterboxd"
import type { parseProfile }    from "./parser"

type Raw = ReturnType<typeof parseProfile>

function filmIdToPath(filmId: string): string {
  // "44542" -> "4/4/5/4/2/44542"
  return filmId.split("").join("/") + "/" + filmId
}

export function transform(raw: Raw): LetterboxdStats {
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
    recentFilms: raw.recentFilms.map(f => {
      // filmId → construct real CDN poster URL (preferred path)
      // posterImgSrc → direct img src scraped from HTML (fallback, rare)
      let posterUrl = ""
      if (f.filmId) {
        posterUrl = `https://a.ltrbxd.com/resized/film-poster/${filmIdToPath(f.filmId)}-${f.slug}-0-230-0-345-crop.jpg`
      } else if (f.posterImgSrc && f.posterImgSrc.startsWith("http")) {
        posterUrl = f.posterImgSrc
      }
      return {
        slug:      f.slug,
        name:      f.name,
        rating:    f.rating,
        year:      f.year,
        posterUrl,
      }
    }),
    fetchedAt: Date.now(),
  }
}

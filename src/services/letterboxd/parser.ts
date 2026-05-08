import * as cheerio from "cheerio"
import { SELECTORS } from "./selectors"

const num = (s: string) => parseInt(s.replace(/,/g, "").trim()) || 0

export function parseProfile(html: string) {
  const $ = cheerio.load(html)

  const recentFilms = $(SELECTORS.recentFilms).slice(0, 8).map((_, el) => {
    const rawName  = $(el).attr("data-item-name") ?? ""
    const yearMatch = rawName.match(/\((\d{4})\)$/)
    const year      = yearMatch ? yearMatch[1] : ""
    const name      = rawName.replace(/\s*\(\d{4}\)$/, "").trim()
    const slug   = $(el).attr("data-item-slug") ?? ""
    const rating = $(el).closest(".griditem").find(SELECTORS.filmRating).first().text().trim()

    // Letterboxd renders film grids client-side: img src is always the empty placeholder.
    // The numeric film ID is encoded in data-postered-identifier as uid:"film:<id>".
    // We use that to construct the real CDN poster URL in the transformer.
    let filmId = ""
    const posterIdentifier = $(el).attr("data-postered-identifier") ?? ""
    if (posterIdentifier) {
      try {
        const parsed = JSON.parse(posterIdentifier)
        const uid = parsed.uid ?? ""                   // e.g. "film:48113"
        filmId = uid.replace(/^film:/, "").trim()      // e.g. "48113"
      } catch { /* malformed JSON — filmId stays empty */ }
    }

    // Only fall back to the img src if the CDN approach won't work (no filmId)
    let posterImgSrc = ""
    if (!filmId) {
      let rawImgSrc = $(el).find("img").first().attr("src") ?? ""
      if (!rawImgSrc || rawImgSrc.includes("empty-poster")) {
        rawImgSrc = $(el).find("img").first().attr("data-src") ?? ""
      }
      if (rawImgSrc && !rawImgSrc.includes("empty-poster")) {
        posterImgSrc = rawImgSrc.startsWith("//") ? `https:${rawImgSrc}` : rawImgSrc
        if (!posterImgSrc.startsWith("http")) posterImgSrc = ""
      }
    }

    return { slug, name, rating, year, filmId, posterImgSrc }
  }).get()

  return {
    username:    $(SELECTORS.username).attr("title") ?? "",
    displayName: $(SELECTORS.displayName).text().trim(),
    memberSince: $(SELECTORS.memberSince).first().text().trim(),
    avatar:      $(SELECTORS.avatar).first().attr("src") ?? "",
    totalFilms:  num($(SELECTORS.totalFilms).first().text()),
    thisYear:    num($(SELECTORS.thisYear).first().text()),
    following:   num($(SELECTORS.following).first().text()),
    followers:   num($(SELECTORS.followers).first().text()),
    lists:       num($(SELECTORS.lists).first().text()),
    recentFilms,
  }
}

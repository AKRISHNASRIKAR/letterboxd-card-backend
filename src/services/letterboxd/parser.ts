import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import { SELECTORS, PAGE_SELECTORS } from "./selectors"

const num = (s: string) => parseInt(s.replace(/,/g, "").trim()) || 0

/** A film as scraped, before the transformer resolves its poster URL. */
export interface RawFilm {
  slug:          string
  name:          string
  rating:        string
  year:          string
  filmId:        string
  posterImgSrc:  string
}

export interface RawProfile {
  username:    string
  displayName: string
  memberSince: string
  avatar:      string
  totalFilms:  number
  thisYear:    number
  following:   number
  followers:   number
  lists:       number
  recentFilms: RawFilm[]
}

export const emptyProfile = (): RawProfile => ({
  username: "", displayName: "", memberSince: "", avatar: "",
  totalFilms: 0, thisYear: 0, following: 0, followers: 0, lists: 0,
  recentFilms: [],
})

/**
 * Letterboxd renders film grids client-side, so an <img> src is always the empty
 * placeholder. The numeric film ID is encoded in data-postered-identifier as
 * uid:"film:<id>", which the transformer turns into a real CDN poster URL.
 */
function parseFilmTile($: cheerio.CheerioAPI, el: Element): RawFilm {
  const $el = $(el)
  const rawName   = $el.attr("data-item-name") ?? ""
  const yearMatch = rawName.match(/\((\d{4})\)$/)
  const year      = yearMatch ? yearMatch[1] : ""
  const name      = rawName.replace(/\s*\(\d{4}\)$/, "").trim()
  const slug      = $el.attr("data-item-slug") ?? ""
  const rating    = $el.closest(".griditem").find(SELECTORS.filmRating).first().text().trim()

  let filmId = ""
  const posterIdentifier = $el.attr("data-postered-identifier") ?? ""
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
    let rawImgSrc = $el.find("img").first().attr("src") ?? ""
    if (!rawImgSrc || rawImgSrc.includes("empty-poster")) {
      rawImgSrc = $el.find("img").first().attr("data-src") ?? ""
    }
    if (rawImgSrc && !rawImgSrc.includes("empty-poster")) {
      posterImgSrc = rawImgSrc.startsWith("//") ? `https:${rawImgSrc}` : rawImgSrc
      if (!posterImgSrc.startsWith("http")) posterImgSrc = ""
    }
  }

  return { slug, name, rating, year, filmId, posterImgSrc }
}

/** Profile root (`/<user>/`) — every field in one page, when it's reachable. */
export function parseProfile(html: string): RawProfile {
  const $ = cheerio.load(html)

  const recentFilms = $(SELECTORS.recentFilms).slice(0, 8)
    .map((_, el) => parseFilmTile($, el as Element)).get()

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

/** `/<user>/films/` — identity, avatar and the all-time watched count. */
export function parseFilmsPage(html: string) {
  const $ = cheerio.load(html)
  const S = PAGE_SELECTORS.films
  return {
    username:    $(S.person).attr("data-person") ?? "",
    displayName: $(S.displayName).first().text().trim(),
    // the mini header serves a 24px avatar; ask the CDN for the 220px crop the
    // profile page would have given us, so the card isn't rendering a thumbnail
    avatar:      upscaleAvatar($(S.avatar).first().attr("src") ?? ""),
    totalFilms:  num($(S.totalFilms).first().attr("title") ?? ""),
    films:       $(S.grid).map((_, el) => parseFilmTile($, el as Element)).get(),
  }
}

/** avtr-0-48-0-48-crop.jpg → avtr-0-220-0-220-crop.jpg */
function upscaleAvatar(src: string): string {
  return src.replace(/avtr-0-\d+-0-\d+-crop/, "avtr-0-220-0-220-crop")
}

/** `/<user>/followers/` — its sub-nav carries both network counts. */
export function parseNetworkPage(html: string) {
  const $ = cheerio.load(html)
  const S = PAGE_SELECTORS.network
  return {
    following: num($(S.following).first().attr("title") ?? ""),
    followers: num($(S.followers).first().attr("title") ?? ""),
  }
}

/** `/<user>/lists/` — the list count plus each list's title and size. */
export function parseListsPage(html: string) {
  const $ = cheerio.load(html)
  const S = PAGE_SELECTORS.lists
  return {
    count: num($(S.count).first().attr("title") ?? ""),
    lists: $(S.summary).map((_, el) => {
      const $el = $(el)
      const link = $el.find(S.title).first()
      return {
        title:     link.text().replace(/\s+/g, " ").trim(),
        url:       link.attr("href") ?? "",
        filmCount: num($el.find(S.value).first().text()),
      }
    }).get(),
  }
}

// ── RSS ───────────────────────────────────────────────────────────────────────

/** "4.5" → "★★★★½" — the RSS feed reports ratings numerically, the site in stars. */
function starsFromRating(raw: string): string {
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return ""
  return "★".repeat(Math.floor(n)) + (n % 1 >= 0.5 ? "½" : "")
}

/**
 * `/<user>/rss/` — the 50 most recent diary entries. Richer than the profile
 * page's four-film strip: it carries watch dates, ratings and, uniquely, direct
 * poster URLs, so posters need no CDN path reconstruction.
 *
 * The feed also contains list-publication items, which have no watchedDate and
 * are skipped.
 */
export function parseRss(xml: string) {
  const $ = cheerio.load(xml, { xmlMode: true })

  const entries = $("item").map((_, el) => {
    const $el = $(el)
    const text = (tag: string) => $el.children().filter((_, c) => c.tagName?.toLowerCase() === tag).first().text().trim()

    const watchedDate = text("letterboxd:watcheddate")
    if (!watchedDate) return null   // list publication, not a diary entry

    const link = text("link")
    const slug = link.match(/\/film\/([^/]+)\//)?.[1] ?? ""
    const poster = text("description").match(/<img src="([^"]+)"/)?.[1] ?? ""

    return {
      slug,
      name:      text("letterboxd:filmtitle"),
      year:      text("letterboxd:filmyear"),
      rating:    starsFromRating(text("letterboxd:memberrating")),
      posterUrl: poster,
      watchedDate,
    }
  }).get().filter(Boolean) as Array<{
    slug: string; name: string; year: string; rating: string; posterUrl: string; watchedDate: string
  }>

  const displayName = $("channel > title").first().text().replace(/^Letterboxd\s*-\s*/, "").trim()
  const year = String(new Date().getUTCFullYear())

  return {
    displayName,
    entries,
    /**
     * Films logged this calendar year. Exact unless the member has logged more
     * than the 50 entries the feed carries, in which case it's a floor — the
     * profile page holds the true figure but Cloudflare blocks it.
     */
    thisYear:        entries.filter(e => e.watchedDate.startsWith(year)).length,
    thisYearIsFloor: entries.length > 0 && entries.every(e => e.watchedDate.startsWith(year)),
  }
}

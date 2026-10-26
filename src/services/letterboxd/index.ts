import {
  fetchProfile, fetchFilms, fetchNetwork, fetchLists, fetchRss,
  BlockedError, UserNotFoundError,
} from "./scraper"
import {
  parseProfile, parseFilmsPage, parseNetworkPage, parseListsPage, parseRss,
  emptyProfile, type RawProfile, type RawFilm,
} from "./parser"
import { transform } from "./transformer"

/**
 * Compose public member pages and RSS. Prefer an explicit current-year profile
 * total. RSS supplies only a conservative lower bound of distinct films.
 */
export async function scrapeStats(username: string) {
  const [root, films, network, lists, rss] = await Promise.allSettled([
    fetchProfile(username),
    fetchFilms(username),
    fetchNetwork(username),
    fetchLists(username),
    fetchRss(username),
  ])

  const settled = [root, films, network, lists, rss]

  // A member who doesn't exist 404s on every path. Any single 200 proves they do,
  // so only treat it as "not found" when nothing at all came back.
  if (settled.every(r => r.status === "rejected")) {
    if (settled.some(r => r.status === "rejected" && r.reason instanceof UserNotFoundError)) {
      throw new UserNotFoundError()
    }
    throw new BlockedError(`https://letterboxd.com/${username}/`)
  }

  const profile = emptyProfile()
  const year = profile.thisYearInfo.year

  // Weakest source first; each later source overwrites what it actually knows.
  if (rss.status === "fulfilled") {
    const feed = parseRss(rss.value, year)
    profile.displayName = feed.displayName
    profile.thisYear    = feed.thisYear
    profile.recentFilms = feed.entries.map(toRawFilm)
    profile.thisYearInfo = { year, accuracy: "lower_bound", source: "rss" }
  }

  if (films.status === "fulfilled") {
    const page = parseFilmsPage(films.value)
    profile.username    = page.username
    profile.displayName = page.displayName || profile.displayName
    profile.avatar      = page.avatar
    profile.totalFilms  = page.totalFilms
    // The films grid is ordered by release date, not watch date, so it is only a
    // stand-in for recent watches when the feed gave us nothing.
    if (profile.recentFilms.length === 0) profile.recentFilms = page.films.slice(0, 8)
  }

  if (network.status === "fulfilled") {
    const { following, followers } = parseNetworkPage(network.value)
    profile.following = following
    profile.followers = followers
  }

  if (lists.status === "fulfilled") {
    profile.lists = parseListsPage(lists.value).count
  }

  if (root.status === "fulfilled") {
    const parsed = parseProfile(root.value, year)
    mergeProfileRoot(profile, parsed)
  }

  if (profile.thisYearInfo.accuracy !== "exact") {
    const reason = root.status === "fulfilled"
      ? "profile_count_missing"
      : root.reason instanceof BlockedError ? "profile_blocked" : "profile_fetch_failed"
    profile.thisYearInfo.reason = reason
    // Never log upstream HTML, cookies, credentials, or raw request headers.
    console.warn(JSON.stringify({
      event: "letterboxd_year_count_incomplete", username, year, reason,
    }))
  }

  profile.username    ||= username
  profile.displayName ||= profile.username

  return transform(profile)
}

/** The root page is authoritative — but only for the fields it actually filled. */
function mergeProfileRoot(into: RawProfile, root: RawProfile): void {
  if (root.username)    into.username    = root.username
  if (root.displayName) into.displayName = root.displayName
  if (root.memberSince) into.memberSince = root.memberSince
  if (root.avatar)      into.avatar      = root.avatar
  if (root.totalFilms)  into.totalFilms  = root.totalFilms
  if (root.following)   into.following   = root.following
  if (root.followers)   into.followers   = root.followers
  if (root.lists)       into.lists       = root.lists
  // An explicit zero is authoritative too; truthiness would discard it.
  if (root.thisYearInfo.accuracy === "exact") {
    into.thisYear = root.thisYear
    into.thisYearInfo = root.thisYearInfo
  }
  // Recent watches stay with RSS: same ordering, more entries, real poster URLs.
  if (into.recentFilms.length === 0) into.recentFilms = root.recentFilms
}

function toRawFilm(e: { slug: string; name: string; year: string; rating: string; posterUrl: string }): RawFilm {
  // RSS hands us the poster URL outright, so there is no film ID to resolve.
  return { slug: e.slug, name: e.name, year: e.year, rating: e.rating, filmId: "", posterImgSrc: e.posterUrl }
}

export {
  fetchProfile, fetchFilms, fetchNetwork, fetchLists, fetchRss,
  BlockedError, UserNotFoundError,
} from "./scraper"
export { parseProfile, parseFilmsPage, parseListsPage, parseRss } from "./parser"

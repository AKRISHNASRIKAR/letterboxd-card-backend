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
 * Build a member's profile.
 *
 * The profile root would give us everything in one request, but Cloudflare
 * challenges that path for non-browser clients (see ./scraper.ts). So we request
 * it alongside the sub-pages that *do* answer — /films/, /followers/, /lists/ and
 * /rss/ — and merge whatever comes back, letting the root win wherever it landed.
 * If Letterboxd ever relaxes that rule the root simply starts winning everywhere,
 * with no further changes here.
 *
 * Every statistic is recoverable from the sub-pages except the exact "films this
 * year" count, which the RSS feed can only floor at 50. That one field degrades;
 * nothing else does.
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
  let thisYearIsFloor = false

  // Weakest source first; each later source overwrites what it actually knows.
  if (rss.status === "fulfilled") {
    const feed = parseRss(rss.value)
    profile.displayName = feed.displayName
    profile.thisYear    = feed.thisYear
    profile.recentFilms = feed.entries.map(toRawFilm)
    thisYearIsFloor     = feed.thisYearIsFloor
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
    const parsed = parseProfile(root.value)
    mergeProfileRoot(profile, parsed)
    if (parsed.thisYear) thisYearIsFloor = false
  }

  if (thisYearIsFloor) {
    console.warn(
      `[letterboxd] "${username}" has logged at least ${profile.thisYear} films this year; ` +
      `reporting the feed's limit because the profile page is blocked.`,
    )
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
  // The one field no other source can pin down exactly.
  if (root.thisYear)    into.thisYear    = root.thisYear
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

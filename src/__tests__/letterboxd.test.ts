import { isChallengePage } from "../services/letterboxd/scraper"
import {
  parseFilmsPage, parseNetworkPage, parseListsPage, parseRss,
} from "../services/letterboxd/parser"

// Trimmed from live responses (Aug 2026). Only the structure the parsers rely on
// is kept — if Letterboxd changes that structure these fail, which is the point.

const CHALLENGE_HTML = `<!DOCTYPE html><html><head><title>Just a moment...</title>
<meta http-equiv="refresh" content="390"></head><body class="no-js">
<div class="main-wrapper"><h1>letterboxd.com</h1>
<p id="cf-spinner-please-wait">Verifying you are human. This may take a few seconds.</p></div>
<script>window._cf_chl_opt={cvId:'3'};</script></body></html>`

const FILMS_HTML = `<html><body class="films-watched" data-owner="akrishnasrikar">
<section class="profile-header js-profile-header" data-person="akrishnasrikar">
  <div class="profile-mini-person">
    <a class="avatar -a24" href="/akrishnasrikar/"><img src="https://a.ltrbxd.com/resized/avatar/upload/9/6/8/1/2/2/7/shard/avtr-0-48-0-48-crop.jpg?v=5bc292bee5" alt="Krishna"></a>
    <h1 class="title-3"><a href="/akrishnasrikar/">Krishna</a></h1>
  </div>
</section>
<div id="content-nav"><h1 class="section-heading"><span class="tooltip" title="2,506&nbsp;films">Watched</span></h1></div>
<div class="poster-grid"><ul class="grid">
  <li class="griditem"><div class="react-component" data-item-name="Vāranāsi (2027)" data-item-slug="varanasi"
    data-postered-identifier='{"lid":"yGmK","uid":"film:826601","type":"film"}'>
    <img src="https://s.ltrbxd.com/static/img/empty-poster-70.png"></div></li>
</ul></div></body></html>`

const NETWORK_HTML = `<html><body><div id="content-nav" class="tabbed gapless">
<section class="sub-nav-wrapper"><ul class="sub-nav">
  <li><a href="/akrishnasrikar/following/" class="tooltip" title="9&nbsp;people">Following</a></li>
  <li class="selected"><a href="/akrishnasrikar/followers/" class="tooltip" title="17&nbsp;people">Followers</a></li>
</ul></section></div></body></html>`

const LISTS_HTML = `<html><body>
<div id="content-nav"><h2 class="section-heading"><span class="tooltip" title="11&nbsp;lists">
  <span class="replace-if-you">Lists</span></span></h2></div>
<div class="list-summary-list"><div class="listitem">
  <article class="list-summary" data-film-list-id="75639264">
    <h2><a href="/akrishnasrikar/list/2024-ranked/">2024 ranked</a></h2>
    <span class="value">80 films</span>
  </article>
</div></div></body></html>`

const RSS_XML = `<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Letterboxd - Krishna</title>
<item><title>Spider-Man: Brand New Day, 2026 - ★★★★★</title>
  <link>https://letterboxd.com/akrishnasrikar/film/spider-man-brand-new-day/</link>
  <letterboxd:watchedDate>2026-08-02</letterboxd:watchedDate>
  <letterboxd:filmTitle>Spider-Man: Brand New Day</letterboxd:filmTitle>
  <letterboxd:filmYear>2026</letterboxd:filmYear>
  <letterboxd:memberRating>5.0</letterboxd:memberRating>
  <description><![CDATA[ <p><img src="https://a.ltrbxd.com/resized/film-poster/8/7/2/8/7/1/872871-spider-man-0-600-0-900-crop.jpg"/></p> ]]></description>
</item>
<item><title>Omkara, 2006 - ★★★★</title>
  <link>https://letterboxd.com/akrishnasrikar/film/omkara/</link>
  <letterboxd:watchedDate>2019-07-31</letterboxd:watchedDate>
  <letterboxd:filmTitle>Omkara</letterboxd:filmTitle>
  <letterboxd:filmYear>2006</letterboxd:filmYear>
  <letterboxd:memberRating>3.5</letterboxd:memberRating>
  <description><![CDATA[ <p><img src="https://a.ltrbxd.com/resized/film-poster/4/2/8/8/0/42880-omkara-0-600-0-900-crop.jpg"/></p> ]]></description>
</item>
<item><title>New list: 10/10 films</title>
  <link>https://letterboxd.com/akrishnasrikar/list/10-10-films/</link>
  <description><![CDATA[ <p>Films which I have no complaints from</p> ]]></description>
</item>
</channel></rss>`

describe("challenge detection", () => {
  // The original bug: a Cloudflare interstitial is valid HTML, so cheerio parsed
  // it into a profile of all zeroes and the API served that as a 200.
  it("recognises a Cloudflare interstitial", () => {
    expect(isChallengePage(CHALLENGE_HTML)).toBe(true)
  })

  it("does not flag real Letterboxd pages", () => {
    expect(isChallengePage(FILMS_HTML)).toBe(false)
    expect(isChallengePage(NETWORK_HTML)).toBe(false)
    expect(isChallengePage(LISTS_HTML)).toBe(false)
    expect(isChallengePage(RSS_XML)).toBe(false)
  })

  it("yields nothing usable when a challenge page is parsed anyway", () => {
    // Belt and braces: even if detection were bypassed, the result must be empty
    // rather than plausible, so a zeroed card can only come from a real profile.
    const parsed = parseFilmsPage(CHALLENGE_HTML)
    expect(parsed.totalFilms).toBe(0)
    expect(parsed.username).toBe("")
  })
})

describe("parseFilmsPage", () => {
  const parsed = parseFilmsPage(FILMS_HTML)

  it("reads identity and the all-time film count", () => {
    expect(parsed.username).toBe("akrishnasrikar")
    expect(parsed.displayName).toBe("Krishna")
    expect(parsed.totalFilms).toBe(2506)
  })

  it("upgrades the 24px header avatar to the 220px crop", () => {
    expect(parsed.avatar).toContain("avtr-0-220-0-220-crop")
  })

  it("recovers film IDs from the client-side poster placeholders", () => {
    expect(parsed.films).toHaveLength(1)
    expect(parsed.films[0]).toMatchObject({ slug: "varanasi", name: "Vāranāsi", year: "2027", filmId: "826601" })
  })
})

describe("parseNetworkPage", () => {
  it("takes both counts from the followers page sub-nav", () => {
    expect(parseNetworkPage(NETWORK_HTML)).toEqual({ following: 9, followers: 17 })
  })
})

describe("parseListsPage", () => {
  const parsed = parseListsPage(LISTS_HTML)

  it("reads the list count", () => {
    expect(parsed.count).toBe(11)
  })

  it("reads each list's title, url and size", () => {
    expect(parsed.lists).toEqual([
      { title: "2024 ranked", url: "/akrishnasrikar/list/2024-ranked/", filmCount: 80 },
    ])
  })
})

describe("parseRss", () => {
  const parsed = parseRss(RSS_XML)

  it("skips list publications, which carry no watch date", () => {
    expect(parsed.entries).toHaveLength(2)
    expect(parsed.entries.map(e => e.slug)).toEqual(["spider-man-brand-new-day", "omkara"])
  })

  it("converts numeric ratings to stars", () => {
    expect(parsed.entries[0].rating).toBe("★★★★★")
    expect(parsed.entries[1].rating).toBe("★★★½")
  })

  it("takes poster URLs straight from the feed", () => {
    expect(parsed.entries[0].posterUrl).toBe(
      "https://a.ltrbxd.com/resized/film-poster/8/7/2/8/7/1/872871-spider-man-0-600-0-900-crop.jpg",
    )
  })

  it("counts only entries watched in the current year", () => {
    const thisYear = String(new Date().getUTCFullYear())
    const expected = parsed.entries.filter(e => e.watchedDate.startsWith(thisYear)).length
    expect(parsed.thisYear).toBe(expected)
    // Mixed years, so the count is complete rather than truncated by the feed.
    expect(parsed.thisYearIsFloor).toBe(false)
  })
})

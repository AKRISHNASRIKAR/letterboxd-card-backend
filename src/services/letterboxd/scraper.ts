import pThrottle from "p-throttle"
import pRetry, { AbortError } from "p-retry"
import { execFile } from "node:child_process"

// Letterboxd sits behind Cloudflare. A subset of member paths — the profile root
// `/<user>/`, anything under `/for/<year>/`, and `/page/<n>/` — is served a
// managed challenge to any client whose TLS ClientHello isn't a real browser's.
// No combination of headers gets Node past it (an identical byte-for-byte request
// over a raw TLS socket is challenged too), so those paths are unusable from here.
//
// The remaining member pages — /films/, /followers/, /lists/, /rss/ — answer
// normally, and between them they carry every statistic the card needs. See
// ./index.ts for how the profile is composed from them.
//
// The failure this replaced: a challenge page is valid HTML, so cheerio parsed it
// happily into a profile of all zeroes and the API served that as a 200.

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0"
]

const REQUEST_TIMEOUT_MS = 10_000

/** Upstream served a bot challenge instead of the page. Never retryable. */
export class BlockedError extends Error {
  constructor(url: string) {
    super(`Blocked by Letterboxd bot protection: ${url}`)
    this.name = "BlockedError"
  }
}

/** Upstream returned 404 — the member does not exist. */
export class UserNotFoundError extends Error {
  constructor() {
    super("User not found")
    this.name = "UserNotFoundError"
  }
}

// Markers that only ever appear in a Cloudflare interstitial, never in a real
// Letterboxd page. Checked against the head of the document so a review quoting
// "just a moment" in body text can't trip it.
const CHALLENGE_MARKERS = [
  "just a moment...",
  "cf-browser-verification",
  "cf_chl_opt",
  "__cf_chl",
  "challenge-platform",
  "attention required! | cloudflare",
  "enable javascript and cookies to continue",
]

export function isChallengePage(html: string): boolean {
  const head = html.slice(0, 4000).toLowerCase()
  return CHALLENGE_MARKERS.some(m => head.includes(m))
}

const throttle = pThrottle({ limit: 5, interval: 1000 })
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const randomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

function browserHeaders(ua: string): Record<string, string> {
  return {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
  }
}

// ── curl escape hatch ─────────────────────────────────────────────────────────
// Cloudflare fingerprints the TLS handshake, not the request: the same URL that
// Node's fetch is challenged on is served normally to `curl --http1.1`. Where a
// curl binary exists we use it to recover the profile root, the only page with an
// exact "films this year" figure. When curl is missing or challenged too, callers
// fall back to the composed sub-page stats — so this is a bonus, never a
// dependency. Probed once per process; a failure disables it for the rest of it.

let curlUsable: boolean | null = null

function curlFetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["-s", "--http1.1", "--compressed", "-m", "10", "-A", randomUserAgent(), "-w", "\n%{http_code}", url],
      { maxBuffer: 20 * 1024 * 1024, timeout: REQUEST_TIMEOUT_MS + 2000 },
      (err, stdout) => {
        if (err) return reject(err)
        const split = stdout.lastIndexOf("\n")
        const status = Number(stdout.slice(split + 1).trim())
        const body = stdout.slice(0, split)
        if (status === 404) return reject(new UserNotFoundError())
        if (status !== 200) return reject(new BlockedError(url))
        if (isChallengePage(body)) return reject(new BlockedError(url))
        resolve(body)
      },
    )
  })
}

async function tryCurl(url: string): Promise<string | null> {
  if (curlUsable === false) return null
  try {
    const html = await curlFetch(url)
    curlUsable = true
    return html
  } catch (err) {
    if (err instanceof UserNotFoundError) throw err
    // ENOENT (no curl binary) or a challenge — either way, stop trying.
    curlUsable = false
    return null
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function fetchOnce(url: string): Promise<string> {
  await delay(100 + Math.random() * 200)

  const res = await fetch(url, {
    headers: browserHeaders(randomUserAgent()),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (res.status === 404) throw new AbortError(new UserNotFoundError())

  // 403/503 from Cloudflare is a challenge verdict, not a transient fault —
  // retrying only burns the function's time budget.
  if (res.status === 403 || res.status === 503) throw new AbortError(new BlockedError(url))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const html = await res.text()
  if (isChallengePage(html)) throw new AbortError(new BlockedError(url))
  return html
}

const rawFetch = (url: string) =>
  pRetry(() => fetchOnce(url), { retries: 2, minTimeout: 600 })

/**
 * Fetch a Letterboxd page, falling back to curl when Cloudflare challenges us.
 * Throws {@link BlockedError} when neither route gets through and
 * {@link UserNotFoundError} when the member doesn't exist.
 */
const fetchPage = throttle(async (url: string): Promise<string> => {
  try {
    return await rawFetch(url)
  } catch (err) {
    if (err instanceof UserNotFoundError) throw err
    if (!(err instanceof BlockedError)) throw err

    const viaCurl = await tryCurl(url)
    if (viaCurl !== null) return viaCurl
    throw err
  }
})

const page = (user: string, path = "") =>
  fetchPage(`https://letterboxd.com/${encodeURIComponent(user)}/${path}`)

/** Profile root. Challenged for most clients — always handle a BlockedError. */
export const fetchProfile = (user: string) => page(user)
/** Watched-films grid: display name, avatar and the all-time film count. */
export const fetchFilms   = (user: string) => page(user, "films/")
/** Followers page — its sub-nav carries both the follower and following counts. */
export const fetchNetwork = (user: string) => page(user, "followers/")
/** Lists page: the list count and each list's title and size. */
export const fetchLists   = (user: string) => page(user, "lists/")
/** RSS feed: the 50 most recent diary entries, with real poster URLs. */
export const fetchRss     = (user: string) => page(user, "rss/")
